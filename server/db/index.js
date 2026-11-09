/**
 * Punto único de acceso a la base de datos.
 *
 * Elige el driver con (en orden de prioridad):
 *   1. variable de entorno DB_DRIVER  ("adodb" | "sqlite")
 *   2. config.db.driver
 *   3. por defecto: "adodb" en Windows (producción actual), "sqlite" en macOS/Linux.
 *
 * Cada driver expone la misma forma:
 *   { name, connection, productsConnection, dialect, source, productsSource }
 *   connection.query(sql) -> filas | connection.execute(sql) | connection.insert(sql) -> id
 *   dialect.top(n) / dialect.limit(n) / dialect.now() / dialect.date(jsDate)
 */
const config = require('../config').getConfig();

const DRIVERS = {
  adodb: () => require('./adodbDriver').createAdodbDriver(config.db || {}),
  sqlite: () => require('./sqliteDriver').createSqliteDriver(config.db || {})
};

function resolveDriverName() {
  const requested = String(process.env.DB_DRIVER || (config.db && config.db.driver) || '').trim().toLowerCase();
  if (requested) {
    if (!DRIVERS[requested]) {
      throw new Error(`DB driver desconocido: "${requested}". Usa "adodb" o "sqlite".`);
    }
    return requested;
  }
  return process.platform === 'win32' ? 'adodb' : 'sqlite';
}

module.exports = DRIVERS[resolveDriverName()]();
