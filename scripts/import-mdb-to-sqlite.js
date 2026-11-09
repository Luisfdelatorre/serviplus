#!/usr/bin/env node
/**
 * Importa una base Access de Aldelo (.mdb) a SQLite, conservando los mismos
 * nombres de tablas y columnas para que aldeloService funcione igual en ambos drivers.
 *
 * Funciona en macOS, Linux y Windows (lee el .mdb con mdb-reader, JavaScript puro).
 *
 * Uso:
 *   npm run db:import                                   # server/kebab.mdb -> data/serviplus.db
 *   node scripts/import-mdb-to-sqlite.js <origen.mdb> <destino.db> [--all-tables] [--force]
 *
 * Por defecto importa solo las tablas que usa Serviplus. --all-tables importa las 80+ de Aldelo.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const MDBReaderModule = require('mdb-reader');

const MDBReader = MDBReaderModule.default || MDBReaderModule;
const ROOT_DIR = path.join(__dirname, '..');

// Tablas de Aldelo que lee o escribe server/aldeloService.js
const SERVIPLUS_TABLES = [
  'MenuItems', 'MenuGroups', 'MenuCategories', 'MenuModifiers', 'MenuModifierPopUps',
  'EmployeeFiles', 'OrderHeaders', 'OrderTransactions', 'OrderPayments',
  'DineInTables', 'DineInTableGroups', 'RegisterCashiers', 'StationSettings', 'KioskPayments'
];

// Tipo de columna Access -> afinidad SQLite
const TYPE_MAP = {
  boolean: 'INTEGER',
  byte: 'INTEGER',
  integer: 'INTEGER',
  long: 'INTEGER',
  bigint: 'INTEGER',
  currency: 'REAL',
  float: 'REAL',
  double: 'REAL',
  numeric: 'REAL',
  datetime: 'TEXT', // ISO-8601
  datetimeextended: 'TEXT',
  text: 'TEXT',
  memo: 'TEXT',
  repid: 'TEXT', // GUID
  binary: 'BLOB',
  ole: 'BLOB'
};

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;

function toSqliteValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') return Number(value);
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function columnDef(col) {
  const type = TYPE_MAP[col.type] || 'TEXT';
  if (col.autoLong) return `${quote(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
  return `${quote(col.name)} ${type}`;
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  return {
    source: path.resolve(ROOT_DIR, positional[0] || path.join('server', 'kebab.mdb')),
    target: path.resolve(ROOT_DIR, positional[1] || path.join('data', 'serviplus.db')),
    allTables: flags.has('--all-tables'),
    force: flags.has('--force')
  };
}

function main() {
  const { source, target, allTables, force } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(source)) {
    console.error(`No existe el archivo de origen: ${source}`);
    process.exit(1);
  }
  if (fs.existsSync(target) && !force) {
    console.error(`Ya existe ${target}. Usa --force para reemplazarlo.`);
    process.exit(1);
  }

  const reader = new MDBReader(fs.readFileSync(source));
  const available = reader.getTableNames();
  const tables = allTables ? available : SERVIPLUS_TABLES.filter((t) => available.includes(t));
  const missing = allTables ? [] : SERVIPLUS_TABLES.filter((t) => !available.includes(t));
  if (missing.length) console.warn(`Aviso: tablas no encontradas en el .mdb: ${missing.join(', ')}`);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(target + suffix)) fs.rmSync(target + suffix);
  }

  const db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL;');

  console.log(`Importando ${tables.length} tablas de ${source}\n  -> ${target}`);
  for (const tableName of tables) {
    const table = reader.getTable(tableName);
    const columns = table.getColumns();

    db.exec(`CREATE TABLE ${quote(tableName)} (${columns.map(columnDef).join(', ')})`);

    const insert = db.prepare(
      `INSERT INTO ${quote(tableName)} (${columns.map((c) => quote(c.name)).join(', ')}) ` +
      `VALUES (${columns.map(() => '?').join(', ')})`
    );

    const rows = table.getData();
    db.exec('BEGIN');
    try {
      for (const row of rows) {
        insert.run(...columns.map((c) => toSqliteValue(row[c.name])));
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Error importando ${tableName}: ${err.message}`);
    }
    console.log(`  ✓ ${tableName.padEnd(22)} ${String(rows.length).padStart(6)} filas`);
  }

  db.close();
  console.log('Listo. Arranca el servidor con DB_DRIVER=sqlite (por defecto en macOS/Linux).');
}

main();
