/**
 * Actualizador de Serviplus: aplica un instalador ya verificado y revierte si falla.
 *
 * Se ejecuta como una COPIA del propio exe (ver createDefaultSpawnUpdater), para que el
 * exe original pueda ser reemplazado. No depende del resto del servidor: solo de Node y
 * de dos módulos auxiliares.
 *
 * Secuencia:
 *   1. Respaldo de la carpeta de la app (y de la base SQLite si existe).
 *   2. Detener el servicio Serviplus.
 *   3. Ejecutar el instalador en silencio (sin reiniciar ni preguntar).
 *   4. Iniciar el servicio y esperar a que responda (hasta 60 s).
 *   5a. Si responde: listo, se borra el pendiente.
 *   5b. Si no: detener, restaurar el respaldo, iniciar y registrar `rolled_back`.
 *
 * Nota: los datos del restaurante viven en ProgramData, fuera de la carpeta de la app, así que
 * el instalador nunca los toca. Solo la base SQLite se respalda, porque las migraciones pueden
 * modificarla al arrancar la versión nueva.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { writeJsonAtomic, readJsonSafe } = require('../lib/atomicFile');

const HEALTH_TIMEOUT_MS = 60000;
const HEALTH_POLL_MS = 2000;
const SERVICE_SETTLE_MS = 3000;
const INSTALLER_ARGS = ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-'];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Orquesta la actualización con dependencias inyectadas (para pruebas y para Windows real).
 * @returns {Promise<{ status: 'noop'|'applied'|'rolled_back', version?: string, error?: string }>}
 */
async function runUpdate(opts, deps) {
  const { appDir, dataDir, pendingPath, serviceExe, port } = opts;
  const { runCommand, copyDir, copyFile, exists, readJson, writeJson, remove, healthy, sleep, log, now } = deps;

  const pending = readJson(pendingPath, null);
  if (!pending) return { status: 'noop' };

  const stateFile = path.join(dataDir, 'update-state.json');
  const recordResult = (result) => {
    const state = readJson(stateFile, {}) || {};
    writeJson(stateFile, { ...state, inProgress: false, lastResult: { ...result, at: new Date(now()).toISOString() } });
  };

  const backupDir = path.join(dataDir, 'update-backup', `${pending.previousVersion || 'previous'}-${timestamp()}`);
  const dbFile = path.join(dataDir, 'serviplus.db');

  log(`Actualizando a ${pending.version} (instalado: ${pending.previousVersion})`);
  writeJson(stateFile, { ...(readJson(stateFile, {}) || {}), inProgress: true });

  async function rollback(reason) {
    log(`Revirtiendo a ${pending.previousVersion}: ${reason}`);
    await runCommand(serviceExe, ['stop']);
    await sleep(SERVICE_SETTLE_MS);
    copyDir(path.join(backupDir, 'app'), appDir);
    if (exists(path.join(backupDir, 'serviplus.db'))) copyFile(path.join(backupDir, 'serviplus.db'), dbFile);
    await runCommand(serviceExe, ['start']);
    const ok = await waitHealthy();
    remove(pendingPath);
    recordResult({ status: 'rolled_back', version: pending.version, error: reason, restored: ok });
    return { status: 'rolled_back', version: pending.version, error: reason };
  }

  async function waitHealthy() {
    const deadline = now() + HEALTH_TIMEOUT_MS;
    while (now() < deadline) {
      if (await healthy(port)) return true;
      await sleep(HEALTH_POLL_MS);
    }
    return false;
  }

  try {
    copyDir(appDir, path.join(backupDir, 'app'));
    if (exists(dbFile)) copyFile(dbFile, path.join(backupDir, 'serviplus.db'));
  } catch (err) {
    recordResult({ status: 'failed', version: pending.version, error: `No se pudo respaldar: ${err.message}` });
    remove(pendingPath);
    return { status: 'failed', error: err.message };
  }

  await runCommand(serviceExe, ['stop']);
  await sleep(SERVICE_SETTLE_MS);

  const install = await runCommand(pending.installerPath, INSTALLER_ARGS);
  if (install.code !== 0) return rollback(`el instalador terminó con código ${install.code}`);

  await runCommand(serviceExe, ['start']);
  if (!(await waitHealthy())) return rollback('la versión nueva no respondió en 60 segundos');

  remove(pendingPath);
  recordResult({ status: 'applied', version: pending.version, backup: backupDir });
  log(`Actualización a ${pending.version} aplicada.`);
  return { status: 'applied', version: pending.version };
}

/** Dependencias reales para Windows. */
function realDeps({ dataDir }) {
  const logFile = path.join(dataDir, 'logs', 'update.log');
  return {
    runCommand: (exe, args) =>
      new Promise((resolve) => {
        execFile(exe, args, { windowsHide: true, timeout: 10 * 60 * 1000 }, (err) => {
          resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0 });
        });
      }),
    copyDir: (src, dest) => fs.cpSync(src, dest, { recursive: true, force: true }),
    copyFile: (src, dest) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    },
    exists: (p) => fs.existsSync(p),
    readJson: (p, fallback) => readJsonSafe(p, fallback),
    writeJson: (p, data) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      writeJsonAtomic(p, data);
    },
    remove: (p) => fs.rmSync(p, { force: true }),
    healthy: (port) =>
      new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/api/license/status', timeout: 3000 }, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        });
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.on('error', () => resolve(false));
      }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (msg) => {
      try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
      } catch (_) {}
      console.log(`[Updater] ${msg}`);
    },
    now: () => Date.now()
  };
}

/** Lee los argumentos --app-dir, --data-dir, --pending, --service-exe y --port, y ejecuta. */
async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const opts = {
    appDir: arg('app-dir'),
    dataDir: arg('data-dir'),
    pendingPath: arg('pending'),
    serviceExe: arg('service-exe'),
    port: Number(arg('port') || 80)
  };
  if (!opts.appDir || !opts.dataDir || !opts.pendingPath || !opts.serviceExe) {
    console.error('Uso: --apply-update --app-dir <dir> --data-dir <dir> --pending <json> --service-exe <exe> [--port 80]');
    return 2;
  }
  const result = await runUpdate(opts, realDeps({ dataDir: opts.dataDir }));
  return result.status === 'rolled_back' || result.status === 'failed' ? 1 : 0;
}

module.exports = { runUpdate, main, INSTALLER_ARGS, HEALTH_TIMEOUT_MS };
