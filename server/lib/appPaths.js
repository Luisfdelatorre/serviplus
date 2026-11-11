/**
 * Rutas base de la aplicación, válidas tanto en desarrollo (código fuente) como en el
 * ejecutable empaquetado (Node SEA) de producción.
 *
 * En desarrollo `__dirname` apunta a `server/lib`, así que la raíz es dos niveles arriba.
 * En el ejecutable empaquetado no hay archivos en disco para el código, por lo que la raíz
 * es la carpeta del propio `serviplus.exe` (`process.execPath`). El instalador deja junto
 * al exe las carpetas `client/dist`, `public`, `scripts`, `assets`, `data` y `config.json`.
 *
 * SP_APP_ROOT permite forzar la raíz (pruebas, o un diseño de carpetas distinto).
 */
const path = require('path');

function detectSea() {
  try {
    return require('node:sea').isSea();
  } catch (_) {
    return false;
  }
}

const IS_PACKAGED = detectSea();

function resolveAppRoot() {
  if (process.env.SP_APP_ROOT) return path.resolve(process.env.SP_APP_ROOT);
  if (IS_PACKAGED) return path.dirname(process.execPath);
  return path.join(__dirname, '..', '..');
}

const APP_ROOT = resolveAppRoot();

// Datos del restaurante (config.json, .env, base SQLite, licencia, respaldos). Fuera de la
// carpeta de la app para que actualizar o reinstalar nunca los toque.
function resolveDataDir() {
  if (process.env.SP_DATA_DIR) return path.resolve(process.env.SP_DATA_DIR);
  if (IS_PACKAGED) return path.join(process.env.ProgramData || 'C:\\ProgramData', 'ServiPlus');
  return path.join(APP_ROOT, 'data');
}

const DATA_DIR = resolveDataDir();

// Carpetas que viven en la raíz tanto en desarrollo como empaquetado.
const CLIENT_DIST = path.join(APP_ROOT, 'client', 'dist');
const PUBLIC_DIR = path.join(APP_ROOT, 'public');
const IMPORT_SCRIPT = path.join(APP_ROOT, 'scripts', 'import-mdb-to-sqlite.js');

// Recursos que en desarrollo están en `server/` y empaquetados en `assets/`.
const assetsDir = IS_PACKAGED ? path.join(APP_ROOT, 'assets') : path.join(APP_ROOT, 'server');
const RAWPRINT_EXE = path.join(assetsDir, 'rawprint.exe');
const SEED_MDB = path.join(assetsDir, 'kebab.mdb');

module.exports = {
  IS_PACKAGED,
  APP_ROOT,
  DATA_DIR,
  CLIENT_DIST,
  PUBLIC_DIR,
  IMPORT_SCRIPT,
  RAWPRINT_EXE,
  SEED_MDB
};
