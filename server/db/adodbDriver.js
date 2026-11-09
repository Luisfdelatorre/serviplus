/**
 * Driver ADODB (Access / Jet) — el que corre hoy en producción con Aldelo 2004.
 * Solo funciona en Windows: node-adodb invoca cscript + Jet OLEDB.
 */
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const DEFAULT_MDB = path.join('server', 'kebab.mdb');

function formatAdodbError(err, sql = '') {
  let realMsg = err.message;
  if (err && err.process) {
    try {
      const parsed = typeof err.process === 'string' ? JSON.parse(err.process) : err.process;
      if (parsed && parsed.message) {
        realMsg = parsed.message;
      }
    } catch (_) {
      realMsg = String(err.process);
    }
  }
  const cleanError = new Error(realMsg);
  cleanError.code = err.code;
  cleanError.process = err.process;
  cleanError.sql = sql;
  return cleanError;
}

function wrapAdodb(conn) {
  return {
    async query(sql) {
      try {
        return await conn.query(sql);
      } catch (err) {
        throw formatAdodbError(err, sql);
      }
    },
    async execute(sql) {
      try {
        return await conn.execute(sql);
      } catch (err) {
        throw formatAdodbError(err, sql);
      }
    },
    // Ejecuta un INSERT y devuelve el ID autonumérico generado.
    async insert(sql) {
      try {
        const rows = await conn.execute(sql, 'SELECT @@Identity AS id');
        return rows && rows.length > 0 ? rows[0].id : null;
      } catch (err) {
        throw formatAdodbError(err, sql);
      }
    }
  };
}

function resolveMdbPath(dataSource) {
  const trimmed = String(dataSource || '').trim();
  if (!trimmed) return path.resolve(ROOT_DIR, DEFAULT_MDB);
  if (path.win32.isAbsolute(trimmed) || path.posix.isAbsolute(trimmed)) return trimmed;
  return path.resolve(ROOT_DIR, trimmed);
}

function applyDataSource(connectionString) {
  const fallback = path.resolve(ROOT_DIR, DEFAULT_MDB);
  const raw = connectionString && /Data Source=/i.test(connectionString)
    ? connectionString
    : `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${fallback};`;
  return raw.replace(/Data Source=([^;]*)/i, (_, source) => `Data Source=${resolveMdbPath(source)}`);
}

// Fecha JS -> número OLE Automation que usa Access (época 1899-12-30)
function toAccessDate(d = new Date()) {
  const startDate = new Date(1899, 11, 30);
  return (d.getTime() - startDate.getTime()) / 86400000;
}

const dialect = {
  top: (n) => `TOP ${n}`,
  limit: () => '',
  now: () => 'Now()',
  date: (d) => String(toAccessDate(d))
};

function createAdodbDriver(dbConfig = {}) {
  // Se carga aquí (no arriba) para que en macOS/Linux el servidor arranque sin node-adodb.
  const ADODB = require('node-adodb');

  const connectionString = applyDataSource(dbConfig.connectionString);
  const connection = wrapAdodb(ADODB.open(connectionString));

  const productsConnectionString = applyDataSource(dbConfig.productsConnectionString || dbConfig.connectionString);
  const productsConnection = (productsConnectionString === connectionString)
    ? connection
    : wrapAdodb(ADODB.open(productsConnectionString));

  return {
    name: 'adodb',
    connection,
    productsConnection,
    dialect,
    source: connectionString,
    productsSource: productsConnectionString
  };
}

module.exports = { createAdodbDriver, toAccessDate };
