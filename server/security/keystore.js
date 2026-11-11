/**
 * Llave de datos del equipo, atada a la máquina.
 *
 * Existe una clave de datos aleatoria por instalación (32 bytes). Está envuelta (cifrada) en
 * `keystore.json` una vez por cada combinación de 3 componentes de la huella de hardware:
 * (placa, MachineGuid, disco, CPU) → 4 envolturas. Para abrirla basta con que coincidan 3 de
 * los 4 componentes, la misma regla que la licencia: un cambio de disco no bloquea la base,
 * pero una copia a otro PC no puede abrirla.
 *
 * Los valores de la huella solo se usan como material de entrada; nunca se guardan en claro.
 */
const fs = require('fs');
const nodeCrypto = require('crypto');
const path = require('path');
const crypto = require('./crypto');
const { writeJsonAtomic, readJsonSafe } = require('../lib/atomicFile');
const { COMPONENTS } = require('../license/fingerprint');

const KEYSTORE_FILE = 'keystore.json';
const WRAP_INFO = 'serviplus-keywrap-v1';
const MIN_COMPONENTS = 3;

class KeystoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Todas las combinaciones de `size` componentes presentes en la huella, en orden fijo. */
function combinations(names, size) {
  if (size === 0) return [[]];
  if (names.length < size) return [];
  const [first, ...rest] = names;
  return [
    ...combinations(rest, size - 1).map((combo) => [first, ...combo]),
    ...combinations(rest, size)
  ];
}

function availableComponents(fp) {
  return COMPONENTS.filter((name) => fp && fp[name]);
}

/** Material de entrada para una combinación: los valores de sus componentes, en orden. */
function comboKeyMaterial(fp, combo) {
  return Buffer.from(combo.map((name) => `${name}=${fp[name]}`).join('|'), 'utf8');
}

function wrapKeyFor(fp, combo, saltBuf) {
  return crypto.deriveKey(comboKeyMaterial(fp, combo), saltBuf, WRAP_INFO);
}

function comboId(combo) {
  return combo.join('+');
}

function keystorePath(dataDir) {
  return path.join(dataDir, KEYSTORE_FILE);
}

function exists(dataDir) {
  return fs.existsSync(keystorePath(dataDir));
}

/**
 * Crea la llave de datos y la envuelve para este equipo. Sobrescribir un keystore existente
 * dejaría inaccesibles los datos cifrados con la llave anterior, así que se niega.
 * @returns {Buffer} la llave de datos (32 bytes) para cifrar la base y los secretos.
 */
function createKeystore(dataDir, fp, dataKey = crypto.randomKey()) {
  if (exists(dataDir)) throw new KeystoreError('EXISTS', 'Ya existe una llave de datos en este equipo.');
  const available = availableComponents(fp);
  if (available.length < MIN_COMPONENTS) {
    throw new KeystoreError('HARDWARE_UNKNOWN', 'No se pudo identificar suficientes componentes del equipo para proteger los datos.');
  }

  const salt = nodeCrypto.randomBytes(16);
  const wraps = {};
  for (const combo of combinations(available, MIN_COMPONENTS)) {
    wraps[comboId(combo)] = crypto.seal(wrapKeyFor(fp, combo, salt), dataKey);
  }
  writeJsonAtomic(keystorePath(dataDir), {
    v: 1,
    salt: salt.toString('base64'),
    wraps,
    createdAt: new Date().toISOString()
  });
  return dataKey;
}

/**
 * Abre la llave de datos con la huella actual. Prueba cada envoltura cuyos componentes
 * coinciden con este equipo.
 * @returns {Buffer|null} la llave, o null si no hay keystore.
 * @throws {KeystoreError} KEY_MISMATCH si el equipo no coincide con ninguna envoltura.
 */
function unlockKeystore(dataDir, fp) {
  const doc = readJsonSafe(keystorePath(dataDir), null);
  if (!doc) return null;
  const salt = Buffer.from(doc.salt, 'base64');
  for (const [id, sealed] of Object.entries(doc.wraps || {})) {
    const combo = id.split('+');
    if (!combo.every((name) => fp && fp[name])) continue;
    try {
      return crypto.open(wrapKeyFor(fp, combo, salt), sealed);
    } catch (_) {
      // Envoltura de otra combinación: probar la siguiente.
    }
  }
  throw new KeystoreError('KEY_MISMATCH', 'Los datos de este restaurante están protegidos para otro equipo.');
}

module.exports = {
  createKeystore,
  unlockKeystore,
  keystoreExists: exists,
  combinations,
  KeystoreError,
  MIN_COMPONENTS
};
