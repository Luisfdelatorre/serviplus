/**
 * Módulo central de configuración.
 *
 * - `config.json` (NO versionado) guarda ajustes operativos editables desde Admin
 *   (restaurante, kiosco, impresora, métodos de pago, URLs...).
 * - `.env` (NO versionado) guarda TODOS los secretos (llaves Wompi, tokens WhatsApp/SMS,
 *   clave del bridge cloud, firma de sesiones y recibos).
 * - `getConfig()` devuelve la fusión de ambos con la misma forma que tenía el antiguo
 *   config.json, para que los servicios existentes sigan funcionando sin cambios.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_PATH = process.env.SP_CONFIG_PATH || path.join(ROOT_DIR, 'config.json');
const EXAMPLE_CONFIG_PATH = path.join(ROOT_DIR, 'config.example.json');
const ENV_PATH = process.env.SP_ENV_PATH || path.join(ROOT_DIR, '.env');

try {
  require('dotenv').config({ path: ENV_PATH, quiet: true });
} catch (e) {
  console.warn('[Config] dotenv no disponible:', e.message);
}

/**
 * Mapa de secretos: variable de entorno -> ruta dentro del objeto de configuración.
 * Estas rutas NUNCA se escriben en config.json ni se devuelven sin enmascarar al cliente.
 */
const SECRET_MAP = [
  ['WOMPI_PRIVATE_KEY', 'wompi.privateKey'],
  ['WOMPI_INTEGRITY_SECRET', 'wompi.integritySecret'],
  ['WOMPI_EVENTS_SECRET', 'wompi.eventsSecret'],
  ['WOMPI_SANDBOX_PRIVATE_KEY', 'wompi.sandbox.privateKey'],
  ['WOMPI_SANDBOX_INTEGRITY_SECRET', 'wompi.sandbox.integritySecret'],
  ['WOMPI_SANDBOX_EVENTS_SECRET', 'wompi.sandbox.eventsSecret'],
  ['SMS_API_KEY', 'sms.apiKey'],
  ['SMS_TOKEN', 'sms.token'],
  ['WA_ACCESS_TOKEN', 'whatsapp.accessToken'],
  ['CLOUD_SECRET_KEY', 'cloud.secretKey']
];

const SECRET_PATHS = SECRET_MAP.map(([, p]) => p);
const MASK_PREFIX = '••••';

// ----------------------------------------------------------------------------
// Utilidades de objetos
// ----------------------------------------------------------------------------
function getPath(obj, dotted) {
  return dotted.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function deletePath(obj, dotted) {
  const keys = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur || typeof cur !== 'object') return;
    cur = cur[keys[i]];
  }
  if (cur && typeof cur === 'object') delete cur[keys[keys.length - 1]];
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(target, source) {
  const out = isPlainObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(source || {})) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

const clone = (o) => JSON.parse(JSON.stringify(o || {}));

// ----------------------------------------------------------------------------
// Lectura / escritura de config.json (con caché por mtime)
// ----------------------------------------------------------------------------
let cache = { mtimeMs: -1, data: {} };

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(EXAMPLE_CONFIG_PATH)) {
    fs.copyFileSync(EXAMPLE_CONFIG_PATH, CONFIG_PATH);
    console.warn('[Config] config.json no existía; se creó a partir de config.example.json');
  }
}

function readFileConfig() {
  try {
    ensureConfigFile();
    const stat = fs.statSync(CONFIG_PATH);
    if (stat.mtimeMs !== cache.mtimeMs) {
      cache = { mtimeMs: stat.mtimeMs, data: JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    }
    return clone(cache.data);
  } catch (e) {
    console.error('[Config] Error leyendo config.json:', e.message);
    return clone(cache.data);
  }
}

function writeFileConfig(data) {
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
  cache = { mtimeMs: -1, data: {} };
}

// ----------------------------------------------------------------------------
// .env (persistencia de secretos editados desde Admin)
// ----------------------------------------------------------------------------
function upsertEnvVars(vars) {
  let content = '';
  try { content = fs.readFileSync(ENV_PATH, 'utf8'); } catch (_) {}
  const lines = content.split(/\r?\n/);
  for (const [key, value] of Object.entries(vars)) {
    const safe = String(value).replace(/\r?\n/g, '');
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = `${key}=${safe}`;
    else lines.push(`${key}=${safe}`);
    process.env[key] = safe;
  }
  fs.writeFileSync(ENV_PATH, lines.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8');
}

// ----------------------------------------------------------------------------
// API pública
// ----------------------------------------------------------------------------

/** Configuración completa (archivo + secretos de entorno). Solo para uso interno del servidor. */
function getConfig() {
  const cfg = readFileConfig();
  for (const [envKey, dotted] of SECRET_MAP) {
    const envVal = process.env[envKey];
    if (envVal !== undefined && envVal !== '') setPath(cfg, dotted, envVal);
  }
  return cfg;
}

function maskSecret(value) {
  if (!value) return '';
  const s = String(value);
  return `${MASK_PREFIX}${s.slice(-4)}`;
}

function isMasked(value) {
  return typeof value === 'string' && value.startsWith(MASK_PREFIX);
}

/** Configuración apta para el panel de administración (secretos enmascarados). */
function getRedactedConfig() {
  const cfg = getConfig();
  for (const dotted of SECRET_PATHS) {
    const v = getPath(cfg, dotted);
    if (v !== undefined) setPath(cfg, dotted, maskSecret(v));
  }
  return cfg;
}

/** Configuración pública (kiosco, recibos). Nunca incluye secretos. */
function getPublicConfig() {
  const cfg = getConfig();
  const wompi = cfg.wompi || {};
  const isSandbox = wompi.mode === 'sandbox';
  return {
    restaurant: cfg.restaurant || {},
    kiosk: cfg.kiosk || {},
    wompi: {
      publicKey: isSandbox ? (wompi.sandbox && wompi.sandbox.publicKey) : wompi.publicKey,
      mode: wompi.mode,
      currency: wompi.currency,
      methods: wompi.methods || {}
    }
  };
}

/**
 * Guarda un parche de configuración (deep merge).
 * Los secretos se envían a `.env`; los valores enmascarados se ignoran.
 */
function saveConfig(patch) {
  if (!isPlainObject(patch)) throw new Error('Configuración inválida');
  const incoming = clone(patch);
  const envUpdates = {};

  for (const [envKey, dotted] of SECRET_MAP) {
    const v = getPath(incoming, dotted);
    if (v === undefined) continue;
    deletePath(incoming, dotted);
    if (isMasked(v)) continue;
    envUpdates[envKey] = v;
  }

  const fileCfg = deepMerge(readFileConfig(), incoming);
  for (const dotted of SECRET_PATHS) deletePath(fileCfg, dotted);
  writeFileConfig(fileCfg);

  if (Object.keys(envUpdates).length > 0) upsertEnvVars(envUpdates);
  return getRedactedConfig();
}

/**
 * Secreto para firmar tokens de sesión. Si no existe se genera uno aleatorio y se
 * persiste en .env (las sesiones sobreviven reinicios).
 */
function getAuthSecret() {
  if (!process.env.AUTH_SECRET) {
    const generated = crypto.randomBytes(48).toString('hex');
    try {
      upsertEnvVars({ AUTH_SECRET: generated });
      console.warn('[Config] AUTH_SECRET no definido; se generó uno nuevo en .env');
    } catch (e) {
      process.env.AUTH_SECRET = generated;
      console.warn('[Config] No se pudo escribir AUTH_SECRET en .env:', e.message);
    }
  }
  return process.env.AUTH_SECRET;
}

module.exports = {
  ROOT_DIR,
  CONFIG_PATH,
  ENV_PATH,
  SECRET_MAP,
  getConfig,
  getRedactedConfig,
  getPublicConfig,
  saveConfig,
  getAuthSecret,
  isMasked,
  maskSecret
};

