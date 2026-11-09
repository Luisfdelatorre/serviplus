/**
 * Bóveda del equipo: arranca el cifrado en reposo.
 *
 *  - Crea o abre la llave de datos (keystore.js) con la huella del equipo.
 *  - Migra el `.env` en claro a `secrets.enc` y carga los secretos en process.env.
 *  - Expone la llave para cifrar la base SQLite y los respaldos.
 *
 * Se activa en el equipo empaquetado o con SP_DATA_ENCRYPTION=1. En desarrollo queda apagada
 * para que el flujo de trabajo y las pruebas sigan siendo simples.
 */
const fs = require('fs');
const path = require('path');
const keystore = require('./keystore');
const secrets = require('./secretsStore');
const { writeJsonAtomic, readJsonSafe } = require('../lib/atomicFile');

const ESCROW_STATE_FILE = 'escrow-state.json';

let state = { enabled: false, dataKey: null, dataDir: null, envPath: null, created: false };

function isEnabledFor({ isPackaged, env = process.env }) {
  if (env.SP_DATA_ENCRYPTION === '0') return false;
  return Boolean(isPackaged || env.SP_DATA_ENCRYPTION === '1');
}

/**
 * Prepara el cifrado. Idempotente: una segunda llamada no cambia nada.
 * @param {{ dataDir: string, envPath: string, enabled: boolean, getFingerprint: () => object }} opts
 */
function init({ dataDir, envPath, enabled, getFingerprint }) {
  if (state.enabled) return getStatus();
  if (!enabled) return getStatus();

  fs.mkdirSync(dataDir, { recursive: true });
  const fp = getFingerprint();
  let dataKey = keystore.unlockKeystore(dataDir, fp);
  let created = false;
  if (!dataKey) {
    dataKey = keystore.createKeystore(dataDir, fp);
    created = true;
  }

  secrets.migrateEnvFile(envPath, dataDir, dataKey);
  const loaded = secrets.loadSecrets(dataDir, dataKey);
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  state = { enabled: true, dataKey, dataDir, envPath, created };
  return getStatus();
}

function getStatus() {
  return { enabled: state.enabled, created: state.created, dataDir: state.dataDir };
}

function isEnabled() {
  return state.enabled;
}

/** Llave de datos en memoria (32 bytes), o null si el cifrado está apagado. */
function getDataKey() {
  return state.dataKey;
}

/** Guarda secretos cifrados. Si el cifrado está apagado devuelve false y el llamador usa .env. */
function saveSecretsEncrypted(updates) {
  if (!state.enabled) return false;
  secrets.mergeSecrets(state.dataDir, state.dataKey, updates);
  return true;
}

function escrowStatePath(dataDir) {
  return path.join(dataDir, ESCROW_STATE_FILE);
}

/** true si la llave ya fue custodiada en el servidor para esta licencia. */
function isEscrowed(licenseId) {
  if (!state.enabled) return true;
  const doc = readJsonSafe(escrowStatePath(state.dataDir), null);
  return Boolean(doc && doc.licenseId === licenseId);
}

function markEscrowed(licenseId) {
  writeJsonAtomic(escrowStatePath(state.dataDir), { licenseId, at: new Date().toISOString() });
}

/** Solo para pruebas: restablece el estado global. */
function _resetForTests() {
  state = { enabled: false, dataKey: null, dataDir: null, envPath: null, created: false };
}

module.exports = {
  init,
  isEnabled,
  isEnabledFor,
  getDataKey,
  getStatus,
  saveSecretsEncrypted,
  isEscrowed,
  markEscrowed,
  _resetForTests
};
