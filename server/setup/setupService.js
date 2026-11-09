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

// Rutas habituales del kebab.mdb de Aldelo en una instalación Windows.
const COMMON_MDB_PATHS = [
  'C:\\SP\\B\\kebab.mdb',
  'C:\\SP\\kebab.mdb',
  'C:\\Aldelo\\kebab.mdb',
  'C:\\Program Files (x86)\\Aldelo\\kebab.mdb'
];

const STEPS = ['database', 'business', 'printer', 'admin'];

function createSetupService({ configStore, aldeloService, importScriptPath = appPaths.IMPORT_SCRIPT, seedMdbPath = appPaths.SEED_MDB } = {}) {
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
      completed: Boolean(setup.completed),
      completedAt: setup.completedAt || null,
      pending: STEPS.filter((s) => !steps[s]),
      steps,
      dbMode: dbMode(),
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

  function importMdbToSqlite(mdbPath, destPath) {
    return new Promise((resolve, reject) => {
      execFile(process.execPath, [importScriptPath, mdbPath, destPath, '--force'], { timeout: 120000 }, (err, stdout, stderr) => {
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
      const target = mdbPath || (firstDetected && firstDetected.path);
      if (!target) throw new Error('No se indicó la ruta del archivo kebab.mdb de Aldelo.');
      const connectionString = `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${target};`;
      configStore.saveConfig({
        db: { driver: 'adodb', connectionString, productsConnectionString: connectionString },
        setup: { steps: { database: true }, restartRequired: true }
      });
      return { mode, restartRequired: true, mdbPath: target };
    }

    if (mode === 'sqlite') {
      const destPath = path.join(configStore.ROOT_DIR, 'data', 'serviplus.db');
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
  async function verifyAdmin(pin) {
    const result = await aldeloService.verifyAdminAccess(pin);
    if (!result.success) return { success: false, error: result.error };
    configStore.saveConfig({ setup: { steps: { admin: true } } });
    return { success: true, employee: { name: result.employee.name || `${result.employee.firstName} ${result.employee.lastName || ''}`.trim() } };
  }

  function complete() {
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
    return Boolean(getSetupConfig().completed);
  }

  return {
    getStatus,
    detectMdb,
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
