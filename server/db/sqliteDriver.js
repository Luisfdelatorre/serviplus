/**
 * Driver SQLite — base local multiplataforma (Windows, macOS, Linux).
 * Usa el módulo nativo node:sqlite (Node >= 22.5), sin dependencias extra.
 *
 * El esquema replica las tablas de Aldelo (mismos nombres de tablas y columnas),
 * así aldeloService usa el mismo SQL en ambos drivers. Ver scripts/import-mdb-to-sqlite.js.
 *
 * Convenciones de datos en SQLite:
 *  - Fechas: texto ISO-8601 en UTC ("2026-11-07T15:04:05.000Z").
 *  - Booleanos: 1 / 0 (SQLite acepta los literales True / False de Access).
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const { DATA_DIR } = require('../lib/appPaths');
const vault = require('../security/vault');
const encrypted = require('./encryptedSqlite');
const { applyPendingRestore } = require('../security/restore');
const DEFAULT_SQLITE_PATH = path.join(DATA_DIR, 'serviplus.db');

function resolveSqlitePath(p) {
  const trimmed = String(p || '').trim() || DEFAULT_SQLITE_PATH;
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(ROOT_DIR, trimmed);
}

const WAL_PRAGMAS = 'PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = OFF;';

function openDatabase(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Base SQLite no encontrada en ${filePath}. Créala con: npm run db:import`
    );
  }
  if (vault.isEnabled()) return openEncryptedDatabase(filePath);

  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(filePath);
  db.exec(WAL_PRAGMAS);
  return db;
}

/** Abre la base cifrada con la llave del equipo. Una base en claro (importada o heredada) se cifra antes. */
function openEncryptedDatabase(filePath) {
  applyPendingRestore(filePath);
  const dataKey = vault.getDataKey();
  if (encrypted.isPlaintextSqlite(filePath)) {
    const { tables } = encrypted.encryptInPlace(filePath, dataKey);
    console.log(`[SQLite] Base cifrada (${tables} tablas): ${filePath}`);
  }
  const db = encrypted.openEncrypted(filePath, dataKey);
  db.exec(WAL_PRAGMAS);
  return db;
}

function wrapSqlite(db) {
  const withSql = (fn, sql) => {
    try {
      return fn();
    } catch (err) {
      err.sql = sql;
      throw err;
    }
  };
  return {
    async query(sql) {
      // node:sqlite devuelve objetos sin prototipo; los normalizamos a objetos planos.
      return withSql(() => db.prepare(sql).all().map((row) => ({ ...row })), sql);
    },
    async execute(sql) {
      withSql(() => db.exec(sql), sql);
    },
    async insert(sql) {
      return withSql(() => Number(db.prepare(sql).run().lastInsertRowid), sql);
    },
    /** Copia consistente de la base a `dest` (cifrada si la base lo está). */
    backupTo(dest) {
      encrypted.vacuumInto(db, dest);
      return dest;
    },
    close() {
      db.close();
    }
  };
}

const dialect = {
  top: () => '',
  limit: (n) => `LIMIT ${n}`,
  now: () => "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
  date: (d) => `'${d.toISOString()}'`
};

function createSqliteDriver(dbConfig = {}) {
  const sqliteConfig = dbConfig.sqlite || {};
  // SQLITE_PATH permite apuntar a otra base sin tocar config.json (tests, pruebas puntuales).
  const mainPath = process.env.SQLITE_PATH || sqliteConfig.path;
  const filePath = resolveSqlitePath(mainPath);
  const productsPath = resolveSqlitePath(process.env.SQLITE_PATH || sqliteConfig.productsPath || sqliteConfig.path);

  const connection = wrapSqlite(openDatabase(filePath));
  const productsConnection = productsPath === filePath
    ? connection
    : wrapSqlite(openDatabase(productsPath));

  return {
    name: 'sqlite',
    connection,
    productsConnection,
    dialect,
    source: filePath,
    productsSource: productsPath
  };
}

module.exports = { createSqliteDriver, resolveSqlitePath };
