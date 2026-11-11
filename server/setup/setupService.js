/**
 * Asistente de primera ejecución (`/setup`).
 *
 * Reúne lo que el instalador no configura y debe decidir el restaurante: modo de base
 * de datos, datos del negocio, impresora y acceso de administrador. El estado "completado"
 * vive en `config.json` bajo `setup`. Mientras no esté completo, el gate lleva a `/setup`.
 *
 * Cambiar el driver de base de datos exige reiniciar el servicio: `server/db` resuelve el
 * driver una sola vez al arrancar. El asistente guarda la configuración y avisa del reinicio.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const appPaths = require('../lib/appPaths');
const nativeFilePicker = require('./nativeFilePicker');

// Rutas habituales del kebab.mdb de Aldelo en una instalación Windows.
const COMMON_MDB_PATHS = [
  'C:\\SP\\B\\kebab.mdb',
  'C:\\SP\\kebab.mdb',
  'C:\\Aldelo\\kebab.mdb',
  'C:\\Program Files (x86)\\Aldelo\\kebab.mdb'
];

const STEPS = ['database', 'business', 'printer', 'admin'];

/** Carpetas antes que archivos; dentro de cada grupo, orden alfabético. */
function compareBrowseEntries(a, b) {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Carpeta superior. En la raíz: la lista de unidades en Windows ('') o ninguna en el resto (null). */
function parentOf(dir, isWin) {
  const up = path.dirname(dir);
  if (up !== dir) return up;
  return isWin ? '' : null;
}

function createSetupService({
  configStore,
  aldeloService,
  // Nombre del driver que está corriendo ahora ("adodb" | "sqlite"). Cambiar el modo de base de datos
  // solo surte efecto tras reiniciar el servicio.
  getActiveDb = () => null,
  // Modo desarrollo: el asistente se da por completado para no bloquear el trabajo diario.
  bypass = false,
  // Diálogo nativo del sistema (inyectable para pruebas).
  pickFile = nativeFilePicker.pickFile,
  importScriptPath = appPaths.IMPORT_SCRIPT,
  seedMdbPath = appPaths.SEED_MDB
} = {}) {
  function getSetupConfig() {
    return (configStore.getConfig().setup) || {};
  }

  /** Primera IPv4 no interna: la dirección que usan kiosko, KDS y caja en la LAN. */
  function lanAddresses() {
    const out = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const net of ifaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) out.push(net.address);
      }
    }
    return out;
  }

  function networkInfo() {
    const port = Number(process.env.PORT) || 80;
    const ips = lanAddresses();
    const portSuffix = port === 80 ? '' : `:${port}`;
    return {
      port,
      ips,
      mdnsUrl: `http://serviplus.local${portSuffix}`,
      lanUrls: ips.map((ip) => `http://${ip}${portSuffix}`)
    };
  }

  function dbMode() {
    const cfg = configStore.getConfig();
    const driver = String(process.env.DB_DRIVER || (cfg.db && cfg.db.driver) || '').toLowerCase();
    if (driver) return driver;
    return process.platform === 'win32' ? 'adodb' : 'sqlite';
  }

  /** Estado del asistente: qué pasos faltan y los valores actuales para precargar el formulario. */
  function getStatus() {
    const cfg = configStore.getConfig();
    const setup = cfg.setup || {};
    const restaurant = cfg.restaurant || {};
    const steps = {
      database: Boolean(setup.steps && setup.steps.database),
      business: Boolean(restaurant.name && restaurant.nit),
      printer: Boolean(setup.steps && setup.steps.printer),
      admin: Boolean(setup.steps && setup.steps.admin)
    };
    return {
      completed: isComplete(),
      bypassed: Boolean(bypass),
      completedAt: setup.completedAt || null,
      pending: STEPS.filter((s) => !steps[s]),
      steps,
      dbMode: dbMode(),
      activeDb: getActiveDb(),
      restartPending: isRestartPending(),
      restartRequired: Boolean(setup.restartRequired),
      business: {
        name: restaurant.name || '',
        legalName: restaurant.legalName || '',
        nit: restaurant.nit || '',
        address: restaurant.address || '',
        phone: restaurant.phone || ''
      },
      network: networkInfo()
    };
  }

  /** true si el modo guardado no es el que está corriendo: hace falta reiniciar el servicio. */
  function isRestartPending() {
    const active = getActiveDb();
    return Boolean(active) && active !== dbMode();
  }

  /** Busca el kebab.mdb de Aldelo en las rutas habituales más la semilla del repo. */
  function detectMdb() {
    const found = [];
    for (const p of [...COMMON_MDB_PATHS, seedMdbPath]) {
      try {
        if (fs.existsSync(p)) found.push({ path: p, size: fs.statSync(p).size });
      } catch (_) {}
    }
    return found;
  }

  /** Limpia y valida la ruta de un kebab.mdb elegido a mano: debe existir y ser un archivo .mdb. */
  function validateMdbPath(input) {
    const target = String(input || '').trim().replace(/^"(.*)"$/, '$1').trim();
    if (!target) throw new Error('No se indicó la ruta del archivo kebab.mdb de Aldelo.');
    // La ruta va dentro de la cadena de conexión OLE DB: ; y comillas la romperían o inyectarían opciones.
    if (/[;"\r\n]/.test(target)) throw new Error('La ruta contiene caracteres no permitidos (; o comillas).');
    if (path.extname(target).toLowerCase() !== '.mdb') throw new Error('El archivo debe tener extensión .mdb.');
    let stat;
    try {
      stat = fs.statSync(target);
    } catch (_) {
      throw new Error(`No se encontró el archivo: ${target}`);
    }
    if (!stat.isFile()) throw new Error(`La ruta no es un archivo: ${target}`);
    return target;
  }

  /** Unidades disponibles en Windows (C:\, D:\, ...). */
  function listDrives() {
    const drives = [];
    for (let code = 65; code <= 90; code++) {
      const root = `${String.fromCharCode(code)}:\\`;
      try {
        if (fs.existsSync(root)) drives.push({ name: root, path: root, type: 'dir' });
      } catch (_) {}
    }
    return drives;
  }

  /**
   * Explorador de archivos del servidor para elegir el kebab.mdb: lista subcarpetas y archivos .mdb.
   * Sin `dir` empieza junto al primer Aldelo detectado, o en las unidades (Windows) / carpeta personal.
   * En Windows la raíz virtual ('') lista las unidades.
   */
  function browse(dir) {
    const isWin = process.platform === 'win32';
    let current = typeof dir === 'string' ? dir.trim() : '';
    if (!current && dir === undefined) {
      const first = detectMdb()[0];
      if (first) current = path.dirname(first.path);
      else if (!isWin) current = os.homedir();
    }

    if (!current && isWin) return { path: '', parent: null, entries: listDrives() };

    let items;
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      throw new Error(`No se pudo abrir la carpeta ${current}: ${err.code || err.message}`);
    }

    const entries = [];
    for (const item of items) {
      if (item.name.startsWith('.')) continue;
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        entries.push({ name: item.name, path: full, type: 'dir' });
      } else if (item.isFile() && path.extname(item.name).toLowerCase() === '.mdb') {
        let size = 0;
        try { size = fs.statSync(full).size; } catch (_) {}
        entries.push({ name: item.name, path: full, type: 'file', size });
      }
    }
    entries.sort(compareBrowseEntries);

    return { path: current, parent: parentOf(current, isWin), entries: entries.slice(0, 500) };
  }

  let pickerOpen = false;

  /** Abre el diálogo nativo del sistema en este equipo y devuelve `{ path }` o `{ cancelled: true }`. */
  async function pickNative() {
    if (pickerOpen) {
      const err = new Error('Ya hay un diálogo de selección abierto en el equipo del servidor.');
      err.code = 'PICKER_BUSY';
      throw err;
    }
    pickerOpen = true;
    try {
      const first = detectMdb()[0];
      return await pickFile({ initialDir: first ? path.dirname(first.path) : '' });
    } finally {
      pickerOpen = false;
    }
  }

  function importMdbToSqlite(mdbPath, destPath) {
    return new Promise((resolve, reject) => {
      // En el exe empaquetado, `process.execPath` es el propio servidor: el importador entra por --run-script.
      const scriptArgs = appPaths.IS_PACKAGED
        ? ['--run-script', importScriptPath, mdbPath, destPath, '--force']
        : [importScriptPath, mdbPath, destPath, '--force'];
      execFile(process.execPath, scriptArgs, { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`Importación fallida: ${stderr || err.message}`));
        resolve(stdout);
      });
    });
  }

  /**
   * Configura el modo de base de datos.
   *  - adodb: fija driver + cadena de conexión al kebab.mdb indicado.
   *  - sqlite: fija driver + ruta; si `importFrom` viene, importa ese .mdb a la base SQLite.
   * Siempre marca `restartRequired`: el driver se resuelve al arrancar.
   */
  async function applyDatabase({ mode, mdbPath, importFrom } = {}) {
    if (mode === 'adodb') {
      const firstDetected = detectMdb()[0];
      const target = validateMdbPath(mdbPath || (firstDetected && firstDetected.path));
      const connectionString = `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${target};`;
      configStore.saveConfig({
        db: { driver: 'adodb', connectionString, productsConnectionString: connectionString },
        setup: { steps: { database: true }, restartRequired: true }
      });
      return { mode, restartRequired: true, mdbPath: target };
    }

    if (mode === 'sqlite') {
      const destPath = path.join(appPaths.DATA_DIR, 'serviplus.db');
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      let imported = false;
      if (importFrom) {
        if (!fs.existsSync(importFrom)) throw new Error(`No se encontró el archivo a importar: ${importFrom}`);
        await importMdbToSqlite(importFrom, destPath);
        imported = true;
      }
      configStore.saveConfig({
        db: { driver: 'sqlite', sqlite: { path: destPath, productsPath: destPath } },
        setup: { steps: { database: true }, restartRequired: true }
      });
      return { mode, restartRequired: true, dbPath: destPath, imported };
    }

    throw new Error('Modo de base de datos inválido. Usa "adodb" o "sqlite".');
  }

  function applyBusiness(business = {}) {
    const name = String(business.name || '').trim();
    const nit = String(business.nit || '').trim();
    if (!name) throw new Error('El nombre del restaurante es obligatorio.');
    if (!nit) throw new Error('El NIT es obligatorio.');
    configStore.saveConfig({
      restaurant: {
        name,
        legalName: String(business.legalName || '').trim() || name,
        nit,
        address: String(business.address || '').trim(),
        phone: String(business.phone || '').trim()
      }
    });
    return getStatus();
  }

  function markPrinterDone() {
    configStore.saveConfig({ setup: { steps: { printer: true } } });
    return getStatus();
  }

  /** Confirma que el PIN del gerente abre el panel de administración en la base activa. */
  function requireRunningDb() {
    if (!isRestartPending()) return;
    const err = new Error('Reinicia el servicio Serviplus para aplicar el modo de base de datos elegido.');
    err.code = 'RESTART_REQUIRED';
    throw err;
  }

  async function verifyAdmin(pin) {
    requireRunningDb();
    const result = await aldeloService.verifyAdminAccess(pin);
    if (!result.success) return { success: false, error: result.error };
    configStore.saveConfig({ setup: { steps: { admin: true } } });
    return { success: true, employee: { name: result.employee.name || `${result.employee.firstName} ${result.employee.lastName || ''}`.trim() } };
  }

  function complete() {
    requireRunningDb();
    const status = getStatus();
    if (status.pending.length > 0) {
      const err = new Error(`Faltan pasos por completar: ${status.pending.join(', ')}.`);
      err.code = 'INCOMPLETE';
      throw err;
    }
    configStore.saveConfig({ setup: { completed: true, completedAt: new Date().toISOString(), restartRequired: false } });
    return getStatus();
  }

  function isComplete() {
    return Boolean(bypass) || Boolean(getSetupConfig().completed);
  }

  return {
    getStatus,
    detectMdb,
    browse,
    pickNative,
    applyDatabase,
    applyBusiness,
    markPrinterDone,
    verifyAdmin,
    complete,
    isComplete,
    networkInfo
  };
}

module.exports = { createSetupService, STEPS };
