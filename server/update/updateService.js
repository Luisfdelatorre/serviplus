/**
 * Actualizaciones de Serviplus (lado del equipo instalado).
 *
 * Flujo: consultar manifiesto firmado → verificar firma y canal → descargar el instalador
 * → verificar SHA-256 y tamaño → (a petición del gerente) lanzar el actualizador.
 * Nunca aplica nada por su cuenta: solo lo deja listo y avisa en el panel de administración.
 *
 * El manifiesto lo firma el mismo par Ed25519 que las licencias (ver scripts/build/sign-release.js).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { verifyDocument } = require('../license/signing');
const { writeJsonAtomic, readJsonSafe } = require('../lib/atomicFile');

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 3 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_SERVER_URL = 'https://serviplus.upaysolutions.app';

class UpdateError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Compara versiones tipo "1.2.10" numéricamente. Devuelve >0 si a > b, <0 si a < b, 0 si iguales. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Valida el manifiesto del portal: { channel, version, url, sha256, signature, keyId, ... }.
 * La firma cubre solo { channel, sha256, url, version }. Lanza UpdateError si algo no cuadra.
 */
function verifyManifest(manifest, { currentVersion, channel }) {
  const signed = {
    alg: 'Ed25519',
    keyId: manifest && manifest.keyId,
    payload: manifest && { channel: manifest.channel, sha256: manifest.sha256, url: manifest.url, version: manifest.version },
    signature: manifest && manifest.signature
  };
  if (!verifyDocument(signed)) throw new UpdateError('BAD_SIGNATURE', 'El manifiesto de actualización no es auténtico.');
  if (manifest.channel !== channel) {
    throw new UpdateError('WRONG_CHANNEL', `El manifiesto es del canal "${manifest.channel}", no de "${channel}".`);
  }
  if (!manifest.version || !manifest.url || !manifest.sha256) {
    throw new UpdateError('BAD_MANIFEST', 'El manifiesto está incompleto.');
  }
  if (compareVersions(manifest.version, currentVersion) <= 0) {
    throw new UpdateError('NOT_NEWER', 'Ya tienes la versión más reciente.');
  }
  return manifest;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readCurrentVersion(appRoot, fallback) {
  try {
    const v = fs.readFileSync(path.join(appRoot, 'VERSION'), 'utf8').trim();
    if (v) return v;
  } catch (_) {}
  return fallback;
}

/**
 * @param {object} deps
 *  - appRoot, dataDir: rutas de la app y de datos
 *  - currentVersion: versión instalada
 *  - isPackaged: true solo en el ejecutable instalado (aplicar solo tiene sentido ahí)
 *  - getConfig(), getChannel(): configuración y canal (de la licencia)
 *  - fetchImpl, now(): inyectables para pruebas
 *  - spawnUpdater(args): lanza el actualizador desacoplado (por defecto, copia y ejecuta)
 */
function createUpdateService({
  appRoot,
  dataDir,
  currentVersion,
  isPackaged,
  getConfig = () => ({}),
  getChannel = () => 'stable',
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  spawnUpdater
}) {
  const statePath = path.join(dataDir, 'update-state.json');
  const pendingPath = path.join(dataDir, 'updates', 'pending.json');
  const packageDir = (version) => path.join(dataDir, 'updates', version);
  let timers = [];

  function readState() {
    return readJsonSafe(statePath, {}) || {};
  }

  function writeState(patch) {
    fs.mkdirSync(dataDir, { recursive: true });
    const next = { ...readState(), ...patch };
    writeJsonAtomic(statePath, next);
    return next;
  }

  function serverUrl() {
    const cfg = getConfig() || {};
    const base = process.env.SP_LICENSE_SERVER_URL || (cfg.license && cfg.license.serverUrl) || (cfg.cloud && cfg.cloud.baseUrl) || DEFAULT_SERVER_URL;
    return base.replace(/\/+$/, '');
  }

  async function getJson(url) {
    let res;
    try {
      res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (_) {
      throw new UpdateError('NETWORK', 'No se pudo contactar el servidor de actualizaciones. Verifica la conexión a internet.', 503);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new UpdateError((json && json.error) || 'SERVER_ERROR', (json && json.message) || `El servidor respondió ${res.status}.`, 502);
    }
    return json || {};
  }

  /** Consulta el canal y guarda el resultado. Nunca descarga ni aplica. */
  async function check() {
    const channel = getChannel();
    const checkedAt = now();
    try {
      const manifest = await getJson(`${serverUrl()}/api/updates/${channel}/latest`);
      const payload = verifyManifest(manifest, { currentVersion, channel });
      writeState({
        lastCheckAt: checkedAt,
        lastError: null,
        available: { version: payload.version, url: payload.url, sha256: payload.sha256, channel, publishedAt: payload.publishedAt, notes: payload.notes }
      });
    } catch (err) {
      // "Ya estás al día" y "no hay versiones en el canal" no son errores: no hay nada disponible.
      if (err.code === 'NOT_NEWER' || err.code === 'no_release') {
        writeState({ lastCheckAt: checkedAt, lastError: null, available: null });
      } else {
        writeState({ lastCheckAt: checkedAt, lastError: { code: err.code || 'ERROR', message: err.message } });
      }
    }
    return getStatus();
  }

  /** Descarga el instalador desde la URL del manifiesto y verifica su SHA-256 firmado. */
  async function download() {
    const available = readState().available;
    if (!available) throw new UpdateError('NOTHING_AVAILABLE', 'No hay una actualización disponible.', 409);

    const dir = packageDir(available.version);
    const finalPath = path.join(dir, `Serviplus-Setup-${available.version}.exe`);
    if (fs.existsSync(finalPath) && sha256File(finalPath) === available.sha256) return finalPath;

    fs.mkdirSync(dir, { recursive: true });
    let res;
    try {
      res = await fetchImpl(new URL(available.url, serverUrl()).toString(), { signal: AbortSignal.timeout(10 * 60 * 1000) });
    } catch (_) {
      throw new UpdateError('NETWORK', 'No se pudo descargar la actualización.', 503);
    }
    if (!res.ok) throw new UpdateError('DOWNLOAD_FAILED', `La descarga falló (HTTP ${res.status}).`, 502);

    const bytes = Buffer.from(await res.arrayBuffer());
    const partial = `${finalPath}.partial`;
    fs.writeFileSync(partial, bytes);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== available.sha256) {
      fs.rmSync(partial, { force: true });
      throw new UpdateError('INTEGRITY', 'El archivo descargado no coincide con el manifiesto firmado. Se descartó.');
    }
    fs.renameSync(partial, finalPath);
    return finalPath;
  }

  /** Pide aplicar la actualización. Solo en el equipo instalado; el actualizador hace el resto. */
  async function apply() {
    if (!isPackaged) {
      throw new UpdateError('NOT_INSTALLED', 'Las actualizaciones solo se aplican en el equipo instalado.', 400);
    }
    const state = readState();
    if (!state.available) throw new UpdateError('NOTHING_AVAILABLE', 'No hay una actualización disponible.', 409);
    if (fs.existsSync(pendingPath)) throw new UpdateError('ALREADY_RUNNING', 'Ya hay una actualización en curso.', 409);

    const installerPath = await download();
    fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
    writeJsonAtomic(pendingPath, {
      version: state.available.version,
      previousVersion: currentVersion,
      installerPath,
      requestedAt: new Date(now()).toISOString()
    });
    if (!spawnUpdater) throw new UpdateError('NOT_SUPPORTED', 'Este equipo no puede lanzar el actualizador.', 500);
    spawnUpdater({ pendingPath, appRoot, dataDir });
    return { started: true, version: state.available.version };
  }

  function getStatus() {
    const state = readState();
    return {
      currentVersion,
      channel: getChannel(),
      canApply: Boolean(isPackaged),
      available: state.available
        ? { version: state.available.version, publishedAt: state.available.publishedAt, notes: state.available.notes || null }
        : null,
      lastCheckAt: state.lastCheckAt || null,
      lastError: state.lastError || null,
      lastResult: state.lastResult || null,
      inProgress: fs.existsSync(pendingPath)
    };
  }

  function start() {
    timers = [
      setTimeout(() => check().catch(() => {}), FIRST_CHECK_DELAY_MS),
      setInterval(() => check().catch(() => {}), CHECK_INTERVAL_MS)
    ];
    for (const t of timers) if (t.unref) t.unref();
  }

  function stop() {
    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    timers = [];
  }

  return { check, download, apply, getStatus, start, stop, readState, writeState };
}

/**
 * Lanza una copia del propio ejecutable como actualizador. Así el exe original puede ser
 * reemplazado por el instalador (Windows no permite sobrescribir un exe en uso).
 * @param {{ execPath: string, workDir: string, serviceExe: string, port: number, appRoot: string, dataDir: string }} cfg
 */
function createDefaultSpawnUpdater(cfg) {
  return ({ pendingPath, appRoot = cfg.appRoot, dataDir = cfg.dataDir }) => {
    fs.mkdirSync(cfg.workDir, { recursive: true });
    const updaterExe = path.join(cfg.workDir, 'serviplus-updater.exe');
    fs.copyFileSync(cfg.execPath, updaterExe);
    const args = [
      '--apply-update',
      '--app-dir', appRoot,
      '--data-dir', dataDir,
      '--pending', pendingPath,
      '--service-exe', cfg.serviceExe,
      '--port', String(cfg.port)
    ];
    spawn(updaterExe, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  };
}

module.exports = {
  createUpdateService,
  verifyManifest,
  compareVersions,
  readCurrentVersion,
  createDefaultSpawnUpdater,
  UpdateError,
  CHECK_INTERVAL_MS
};
