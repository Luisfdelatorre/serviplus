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
const DEFAULT_SQLITE_PATH = path.join('data', 'serviplus.db');

function resolveSqlitePath(p) {
  const trimmed = String(p || '').trim() || DEFAULT_SQLITE_PATH;
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(ROOT_DIR, trimmed);
}

function openDatabase(filePath) {
  const { DatabaseSync } = require('node:sqlite');
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Base SQLite no encontrada en ${filePath}. Créala con: npm run db:import`
    );
  }
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = OFF;');
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
