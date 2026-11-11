/**
 * Firma y verificación Ed25519 de documentos JSON (licencias, manifiestos de actualización).
 * El JSON se serializa de forma canónica (claves ordenadas) para que la firma sea estable.
 */
const crypto = require('crypto');
const fs = require('fs');
const { PUBLIC_KEYS } = require('./publicKeys');
const { PACKAGED } = require('./buildFlags');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

/** Firma `payload` con una clave privada PEM. Solo lo usan las herramientas del proveedor. */
function signDocument(payload, privateKeyPem, kid) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload), 'utf8'), key);
  return { alg: 'Ed25519', kid, payload, signature: signature.toString('base64') };
}

/** Identificador de una clave pública, igual que en el servidor: SHA-256 de su DER (SPKI), 16 hex. */
function keyIdFor(pem) {
  const der = crypto.createPublicKey(pem).export({ format: 'der', type: 'spki' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

/** Claves aceptadas: las embebidas (por keyId) y, solo fuera del build empaquetado, una de desarrollo. */
function getPublicKeys() {
  const keys = {};
  for (const pem of Object.values(PUBLIC_KEYS)) keys[keyIdFor(pem)] = pem;
  // Override solo en desarrollo desde código fuente; desactivado en builds empaquetados.
  if (!PACKAGED && process.env.SP_LICENSE_PUBLIC_KEY_FILE) {
    try {
      const pem = fs.readFileSync(process.env.SP_LICENSE_PUBLIC_KEY_FILE, 'utf8');
      keys[keyIdFor(pem)] = pem;
      if (process.env.SP_LICENSE_PUBLIC_KEY_KID) keys[process.env.SP_LICENSE_PUBLIC_KEY_KID] = pem;
    } catch (e) {
      console.warn('[License] No se pudo leer SP_LICENSE_PUBLIC_KEY_FILE:', e.message);
    }
  }
  return keys;
}

/**
 * Devuelve true solo si el documento está firmado por una clave conocida.
 * Acepta `keyId` (servidor de licencias) o `kid` (herramienta local).
 */
function verifyDocument(doc) {
  if (!doc || typeof doc !== 'object' || doc.alg !== 'Ed25519') return false;
  if (!doc.payload || typeof doc.signature !== 'string') return false;
  const pem = getPublicKeys()[doc.keyId || doc.kid];
  if (!pem) return false;
  try {
    return crypto.verify(
      null,
      Buffer.from(canonicalJson(doc.payload), 'utf8'),
      crypto.createPublicKey(pem),
      Buffer.from(doc.signature, 'base64')
    );
  } catch (_) {
    return false;
  }
}

module.exports = { canonicalJson, signDocument, verifyDocument, keyIdFor };
