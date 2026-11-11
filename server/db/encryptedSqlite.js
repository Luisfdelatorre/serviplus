/**
 * SQLite cifrado (SQLCipher vía better-sqlite3-multiple-ciphers).
 *
 * Usa la llave de datos del equipo (32 bytes). Un archivo cifrado no tiene cabecera SQLite
 * legible: sin la llave es ruido aleatorio, y copiarlo a otro PC no sirve.
 */
const fs = require('fs');

const PLAIN_HEADER = 'SQLite format 3\0';

function keyPragma(dataKey) {
  return `PRAGMA key = "x'${dataKey.toString('hex')}'"`;
}

function isPlaintextSqlite(file) {
  if (!fs.existsSync(file)) return false;
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    return buf.toString('latin1') === PLAIN_HEADER;
  } finally {
    fs.closeSync(fd);
  }
}

/** Abre una base cifrada. Lanza si la llave no corresponde. */
function openEncrypted(file, dataKey) {
  const Database = require('better-sqlite3-multiple-ciphers');
  const db = new Database(file);
  db.pragma(keyPragma(dataKey).replace(/^PRAGMA /, ''));
  // Comprobación temprana: con clave incorrecta la primera lectura falla aquí, no en mitad de un pedido.
  db.prepare('SELECT count(*) AS n FROM sqlite_master').get();
  return db;
}

/** Nombre de tabla entre comillas dobles, escapado. */
function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Copia esquema y datos de la base en claro a un archivo cifrado nuevo. Esta build de SQLCipher
 * no trae sqlcipher_export, así que se recrean tablas, índices, disparadores y vistas dentro del
 * archivo cifrado y luego se copian las filas tabla por tabla.
 */
function copyToEncrypted(plain, tmp, dataKey) {
  plain.prepare('ATTACH DATABASE ? AS enc KEY ?').run(tmp, `x'${dataKey.toString('hex')}'`);
  const objects = plain.prepare(
    "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid"
  ).all();
  for (const obj of objects) {
    const withSchema = obj.sql.replace(/^(CREATE(?:\s+UNIQUE)?\s+(?:TABLE|INDEX|TRIGGER|VIEW)(?:\s+IF\s+NOT\s+EXISTS)?)\s+/i, '$1 enc.');
    plain.exec(withSchema);
  }
  const tables = objects.filter((o) => o.type === 'table').map((o) => o.name);
  for (const name of tables) {
    plain.exec(`INSERT INTO enc.${quoteIdent(name)} SELECT * FROM main.${quoteIdent(name)}`);
  }
  plain.prepare('DETACH DATABASE enc').run();
  return { tables: tables.length };
}

/**
 * Convierte una base en claro a cifrada, sin perder datos.
 * La versión cifrada se escribe aparte, se verifica con el mismo número de tablas y filas y
 * solo entonces reemplaza a la original (que se borra junto con sus archivos -wal y -shm).
 */
function encryptInPlace(file, dataKey) {
  const Database = require('better-sqlite3-multiple-ciphers');
  const tmp = `${file}.enc-tmp`;
  fs.rmSync(tmp, { force: true });

  const plain = new Database(file);
  plain.pragma('wal_checkpoint(TRUNCATE)');
  const plainTables = plain.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const plainCounts = Object.fromEntries(plainTables.map((t) => [t, plain.prepare(`SELECT count(*) AS n FROM ${quoteIdent(t)}`).get().n]));
  copyToEncrypted(plain, tmp, dataKey);
  plain.close();

  const encrypted = openEncrypted(tmp, dataKey);
  const mismatch = plainTables.find((t) => encrypted.prepare(`SELECT count(*) AS n FROM ${quoteIdent(t)}`).get().n !== plainCounts[t]);
  encrypted.close();
  if (mismatch) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`La migración a base cifrada no coincide en la tabla ${mismatch}. La base original se conserva.`);
  }

  for (const suffix of ['-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  fs.renameSync(tmp, file);
  return { tables: plainTables.length };
}

/** Escribe una copia cifrada con la misma llave a `dest` (consistente aunque la app esté usándola). */
function vacuumInto(db, dest) {
  fs.rmSync(dest, { force: true });
  db.prepare('VACUUM INTO ?').run(dest);
}

/**
 * Restaura una copia cifrada con `srcKey` a un archivo cifrado con `destKey` (p. ej. respaldo de
 * otro equipo). Escribe primero a un temporal y solo reemplaza `destFile` si todo coincide.
 */
function rekeyFile(srcFile, srcKey, destFile, destKey) {
  const tmp = `${destFile}.rekey-tmp`;
  fs.rmSync(tmp, { force: true });
  const source = openEncrypted(srcFile, srcKey);
  const { tables } = copyToEncrypted(source, tmp, destKey);
  source.close();

  const check = openEncrypted(tmp, destKey);
  const count = check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get().n;
  check.close();
  if (count !== tables) {
    fs.rmSync(tmp, { force: true });
    throw new Error('La restauración no coincide con el respaldo; no se reemplazó la base.');
  }
  for (const suffix of ['-wal', '-shm']) fs.rmSync(destFile + suffix, { force: true });
  fs.renameSync(tmp, destFile);
  return { tables };
}

module.exports = { openEncrypted, encryptInPlace, isPlaintextSqlite, vacuumInto, rekeyFile };
