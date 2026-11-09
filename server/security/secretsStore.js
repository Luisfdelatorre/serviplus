/**
 * Secretos del restaurante (llaves de Wompi, tokens de WhatsApp/SMS, AUTH_SECRET...) cifrados
 * con la llave de datos. Reemplazan al `.env` en claro cuando el cifrado está activo.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('./crypto');
const { writeJsonAtomic, readJsonSafe } = require('../lib/atomicFile');

const SECRETS_FILE = 'secrets.enc';

function secretsPath(dataDir) {
  return path.join(dataDir, SECRETS_FILE);
}

function loadSecrets(dataDir, dataKey) {
  const sealed = readJsonSafe(secretsPath(dataDir), null);
  if (!sealed) return {};
  return JSON.parse(crypto.open(dataKey, sealed).toString('utf8'));
}

function saveSecrets(dataDir, dataKey, secrets) {
  writeJsonAtomic(secretsPath(dataDir), crypto.seal(dataKey, Buffer.from(JSON.stringify(secrets), 'utf8')));
}

/** Mezcla `updates` en los secretos guardados y los devuelve. */
function mergeSecrets(dataDir, dataKey, updates) {
  const next = { ...loadSecrets(dataDir, dataKey), ...updates };
  saveSecrets(dataDir, dataKey, next);
  return next;
}

/**
 * Si existe un `.env` en claro (instalación anterior), lo migra a `secrets.enc`, verifica que
 * se pueda leer de vuelta y solo entonces lo borra.
 * @returns {boolean} true si hubo migración.
 */
function migrateEnvFile(envPath, dataDir, dataKey) {
  if (!fs.existsSync(envPath)) return false;
  const fromEnv = dotenv.parse(fs.readFileSync(envPath));
  const merged = mergeSecrets(dataDir, dataKey, fromEnv);
  const check = loadSecrets(dataDir, dataKey);
  if (JSON.stringify(check) !== JSON.stringify(merged)) {
    throw new Error('La verificación del respaldo de secretos falló; el .env se conserva.');
  }
  fs.rmSync(envPath, { force: true });
  return true;
}

module.exports = { loadSecrets, saveSecrets, mergeSecrets, migrateEnvFile, secretsPath };
