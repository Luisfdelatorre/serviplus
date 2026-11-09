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

function getPublicKeys() {
  const keys = { ...PUBLIC_KEYS };
  // Override solo en desarrollo desde código fuente; desactivado en builds empaquetados.
  if (!PACKAGED && process.env.SP_LICENSE_PUBLIC_KEY_FILE) {
    try {
      keys[process.env.SP_LICENSE_PUBLIC_KEY_KID || 'dev'] = fs.readFileSync(process.env.SP_LICENSE_PUBLIC_KEY_FILE, 'utf8');
    } catch (e) {
      console.warn('[License] No se pudo leer SP_LICENSE_PUBLIC_KEY_FILE:', e.message);
    }
  }
  return keys;
}

/** Devuelve true solo si el documento está firmado por una de las claves públicas conocidas. */
function verifyDocument(doc) {
  if (!doc || typeof doc !== 'object' || doc.alg !== 'Ed25519') return false;
  if (!doc.payload || typeof doc.signature !== 'string') return false;
  const pem = getPublicKeys()[doc.kid];
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

module.exports = { canonicalJson, signDocument, verifyDocument };
