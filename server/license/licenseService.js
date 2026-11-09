/**
 * Servicio de licencia de Serviplus.
 *
 * Estados:
 *  - `dev`        Código fuente sin SP_LICENSE_ENFORCE=1: no se exige licencia (solo desarrollo).
 *  - `unlicensed` No hay licencia instalada → solo se permite activar.
 *  - `invalid`    Licencia manipulada, de otra máquina o con firma desconocida → solo activar.
 *  - `valid`      Todo en orden.
 *  - `grace`      Revocada o vencida: funciona normal con aviso durante 72 h.
 *  - `blocked`    Terminó la gracia: se bloquean pedidos y pagos NUEVOS. Lo demás sigue
 *                 (cerrar pedidos abiertos, cierre de caja, reportes). Nunca se borran datos.
 *
 * Una licencia perpetua sin internet nunca se bloquea: el heartbeat es solo informativo.
 */
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic, readJsonSafe } = require('../lib/atomicFile');
const { verifyDocument } = require('./signing');
const { getFingerprint, machineCode, matchFingerprint } = require('./fingerprint');
const { PACKAGED } = require('./buildFlags');
const vault = require('../security/vault');

const GRACE_MS = 72 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 60 * 1000;
const FIRST_HEARTBEAT_DELAY_MS = 2 * 60 * 1000;
const CLOCK_SAVE_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_SERVER_URL = 'https://serviplus.upaysolutions.app';
const PRODUCT = 'serviplus';

const APP_VERSION = (() => {
  try {
    return require('../../package.json').version || '0.0.0';
  } catch (_) {
    return '0.0.0';
  }
})();

function defaultDataDir() {
  if (process.env.SP_DATA_DIR) return process.env.SP_DATA_DIR;
  if (PACKAGED && process.platform === 'win32') {
    return path.join(process.env.ProgramData || 'C:\\ProgramData', 'ServiPlus');
  }
  return path.join(__dirname, '../../data');
}

class LicenseError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function createLicenseService({ getConfig = () => ({}), dataDir = defaultDataDir(), fetchImpl = globalThis.fetch, now = () => Date.now(), fingerprint = getFingerprint } = {}) {
  const licensePath = path.join(dataDir, 'license.lic');
  const statePath = path.join(dataDir, 'license-state.json');
  const listeners = new Set();
  let timers = [];
  let lastClockSaveAt = 0;
  let lastSummaryKey = null;

  function ensureDir() {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  function readState() {
    return readJsonSafe(statePath, {}) || {};
  }

  function writeState(patch) {
    ensureDir();
    const next = { ...readState(), ...patch };
    writeJsonAtomic(statePath, next);
    return next;
  }

  function readLicense() {
    return readJsonSafe(licensePath, null);
  }

  function isEnforced() {
    return PACKAGED || process.env.SP_LICENSE_ENFORCE === '1';
  }

  function licenseConfig() {
    const cfg = getConfig() || {};
    return {
      // Redirigir el servidor es inofensivo: sin la clave privada no puede emitir licencias válidas.
      serverUrl: process.env.SP_LICENSE_SERVER_URL || (cfg.license && cfg.license.serverUrl) || (cfg.cloud && cfg.cloud.baseUrl) || DEFAULT_SERVER_URL,
      supportContact: (cfg.license && cfg.license.supportContact) || ''
    };
  }

  /** Reloj monotónico: nunca retrocede aunque alguien atrase la hora de Windows. */
  function trustedNow(state) {
    const t = now();
    const lastSeen = Number(state.lastSeenAt) || 0;
    if (t - lastClockSaveAt > CLOCK_SAVE_INTERVAL_MS && t > lastSeen) {
      lastClockSaveAt = t;
      try {
        writeState({ lastSeenAt: t });
      } catch (_) {}
    }
    return Math.max(t, lastSeen);
  }

  /** Verifica firma, producto y máquina de un documento de licencia. Lanza LicenseError. */
  function validateDocument(doc, fp = fingerprint()) {
    if (!verifyDocument(doc)) throw new LicenseError('TAMPERED', 'La licencia no es auténtica o fue modificada.');
    const p = doc.payload;
    if (p.product !== PRODUCT || !p.licenseId) throw new LicenseError('TAMPERED', 'La licencia no corresponde a Serviplus.');
    if (!matchFingerprint(p.fingerprint, fp).ok) {
      throw new LicenseError('MACHINE_MISMATCH', 'Esta licencia pertenece a otro equipo. Contacta a soporte para trasladarla.');
    }
    return p;
  }

  function computeStatus() {
    const fp = fingerprint();
    const base = { machineCode: machineCode(fp), appVersion: APP_VERSION, supportContact: licenseConfig().supportContact };

    if (!isEnforced()) {
      return { ...base, status: 'dev', allowed: true, message: 'Modo desarrollo: licencia no exigida.' };
    }

    const doc = readLicense();
    if (!doc) {
      return { ...base, status: 'unlicensed', allowed: false, message: 'Este equipo no tiene una licencia activada.' };
    }

    let payload;
    try {
      payload = validateDocument(doc, fp);
    } catch (err) {
      return { ...base, status: 'invalid', reason: err.code, allowed: false, message: err.message };
    }

    const state = readState();
    const t = trustedNow(state);
    const license = {
      licenseId: payload.licenseId,
      restaurantId: payload.restaurantId,
      restaurantName: payload.restaurantName || null,
      features: Array.isArray(payload.features) ? payload.features : [],
      expiresAt: payload.expiresAt || null,
      channel: payload.channel || 'stable',
      issuedAt: payload.issuedAt || null
    };
    const info = { ...base, license, lastHeartbeatAt: state.lastHeartbeatAt || null };

    // Inicio de la gracia: revocación remota o fecha de vencimiento (lo que ocurra primero).
    const expiresAtMs = license.expiresAt ? Date.parse(license.expiresAt) : NaN;
    const graceStarts = [Number(state.revokedAt) || NaN, expiresAtMs].filter((v) => Number.isFinite(v) && v <= t);
    if (graceStarts.length === 0) {
      return { ...info, status: 'valid', allowed: true };
    }

    const graceEndsAt = Math.min(...graceStarts) + GRACE_MS;
    const reason = state.revokedAt ? 'REVOKED' : 'EXPIRED';
    if (t < graceEndsAt) {
      return {
        ...info,
        status: 'grace',
        reason,
        allowed: true,
        graceEndsAt: new Date(graceEndsAt).toISOString(),
        message: 'La licencia requiere atención. Contacta a soporte antes de que termine el periodo de gracia.'
      };
    }
    return {
      ...info,
      status: 'blocked',
      reason,
      allowed: true,
      blocksNewOrders: true,
      graceEndsAt: new Date(graceEndsAt).toISOString(),
      message: 'Terminó el periodo de gracia: no se pueden registrar pedidos nuevos. Contacta a soporte.'
    };
  }

  // Caché corta: el gate consulta el estado en cada petición y verificar la firma cuesta.
  let cache = null;
  function getStatus() {
    if (cache && now() - cache.at < 30 * 1000) return cache.summary;
    const summary = computeStatus();
    cache = { at: now(), summary };
    return summary;
  }

  function notifyIfChanged() {
    cache = null;
    const summary = getStatus();
    const key = `${summary.status}|${summary.reason || ''}|${summary.graceEndsAt || ''}`;
    if (key !== lastSummaryKey) {
      lastSummaryKey = key;
      for (const fn of listeners) {
        try {
          fn(summary);
        } catch (_) {}
      }
    }
    return summary;
  }

  function installDocument(doc) {
    validateDocument(doc);
    ensureDir();
    writeJsonAtomic(licensePath, doc);
    writeState({ revokedAt: null, installedAt: now(), lastSeenAt: Math.max(now(), Number(readState().lastSeenAt) || 0) });
    return notifyIfChanged();
  }

  async function postJson(route, body) {
    const url = `${licenseConfig().serverUrl.replace(/\/+$/, '')}${route}`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch (_) {
      throw new LicenseError('NETWORK', 'No se pudo contactar el servidor de licencias. Verifica la conexión a internet.', 503);
    }
    let json = null;
    try {
      json = await res.json();
    } catch (_) {}
    if (!res.ok || !json || json.success === false) {
      const msg = (json && json.error) || `El servidor de licencias respondió ${res.status}.`;
      throw new LicenseError((json && json.code) || 'SERVER_ERROR', msg, res.status >= 500 ? 502 : 400);
    }
    return json.data || {};
  }

  /**
   * Custodia la llave de datos en el servidor (escrow) para poder restaurar este equipo.
   * Si falla, no pasa nada grave: el heartbeat lo vuelve a intentar.
   */
  async function escrowKeyIfNeeded(doc) {
    const dataKey = vault.getDataKey();
    if (!vault.isEnabled() || !dataKey) return;
    const licenseId = doc.payload.licenseId;
    if (vault.isEscrowed(licenseId)) return;
    try {
      await postJson('/api/license/escrow', {
        licenseId,
        fingerprint: fingerprint(),
        dataKey: dataKey.toString('base64')
      });
      vault.markEscrowed(licenseId);
    } catch (err) {
      console.warn('[License] Custodia de la llave pendiente:', err.message);
    }
  }

  /**
   * Pide al servidor la llave de un respaldo anterior (solo se entrega en una restauración
   * autorizada). Se usa para re-cifrar el respaldo con la llave de este equipo.
   */
  async function fetchEscrowKey(licenseId) {
    const data = await postJson('/api/license/escrow/retrieve', { licenseId, fingerprint: fingerprint() });
    if (!data.dataKey) throw new LicenseError('NOT_RELEASED', 'El servidor no liberó la llave de respaldo para este equipo.', 403);
    return Buffer.from(data.dataKey, 'base64');
  }

  /** Activación online: envía clave + huella, recibe la licencia firmada para esta máquina. */
  async function activate(licenseKey) {
    const key = String(licenseKey || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{8,64}$/.test(key)) throw new LicenseError('BAD_KEY', 'La clave de licencia no tiene un formato válido.');
    const fp = fingerprint();
    const data = await postJson('/api/license/activate', {
      licenseKey: key,
      fingerprint: fp,
      machineCode: machineCode(fp),
      appVersion: APP_VERSION
    });
    if (!data.license) throw new LicenseError('SERVER_ERROR', 'El servidor no devolvió una licencia.', 502);
    const status = installDocument(data.license);
    await escrowKeyIfNeeded(data.license);
    return status;
  }

  /** Importa un archivo .lic pegado manualmente (respaldo para soporte). */
  function importLicense(doc) {
    const parsed = typeof doc === 'string' ? JSON.parse(doc) : doc;
    return installDocument(parsed);
  }

  /** Consulta al servidor revocaciones y licencias renovadas. Los fallos de red se ignoran. */
  async function heartbeat() {
    if (!isEnforced()) return getStatus();
    const doc = readLicense();
    if (!doc || !doc.payload) return getStatus();
    try {
      const data = await postJson('/api/license/heartbeat', {
        licenseId: doc.payload.licenseId,
        fingerprint: fingerprint(),
        appVersion: APP_VERSION
      });
      const state = readState();
      const patch = { lastHeartbeatAt: now(), lastServerStatus: data.status || null };
      if (data.revoked && !state.revokedAt) patch.revokedAt = now();
      if (data.revoked === false && state.revokedAt) patch.revokedAt = null;
      writeState(patch);
      if (data.license) {
        try {
          validateDocument(data.license);
          writeJsonAtomic(licensePath, data.license);
        } catch (err) {
          console.warn('[License] Licencia renovada rechazada:', err.message);
        }
      }
      await escrowKeyIfNeeded(doc);
    } catch (err) {
      if (err.code !== 'NETWORK') console.warn('[License] Heartbeat:', err.message);
    }
    return notifyIfChanged();
  }

  function start() {
    const summary = notifyIfChanged();
    console.log(`[License] Estado: ${summary.status}${summary.reason ? ` (${summary.reason})` : ''} · Equipo ${summary.machineCode}`);
    if (!isEnforced()) return;
    timers = [
      setTimeout(() => heartbeat().catch(() => {}), FIRST_HEARTBEAT_DELAY_MS),
      setInterval(() => heartbeat().catch(() => {}), HEARTBEAT_INTERVAL_MS),
      // Re-evalúa cada minuto para pasar de gracia a bloqueo sin reiniciar.
      setInterval(notifyIfChanged, 60 * 1000)
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

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { getStatus, activate, importLicense, heartbeat, fetchEscrowKey, start, stop, onChange, isEnforced };
}

module.exports = { createLicenseService, LicenseError, GRACE_MS, APP_VERSION };
