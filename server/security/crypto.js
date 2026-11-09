/**
 * Primitivas de cifrado: AES-256-GCM para sellar datos y HKDF-SHA256 para derivar claves.
 * Cada sellado lleva su propio IV aleatorio; GCM detecta cualquier alteración del contenido.
 */
const crypto = require('crypto');

const KEY_BYTES = 32;
const IV_BYTES = 12;

function randomKey() {
  return crypto.randomBytes(KEY_BYTES);
}

/** Sella `plaintext` (Buffer) con `key` (Buffer de 32 bytes). Devuelve { iv, tag, data } en base64. */
function seal(key, plaintext) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  };
}

/** Abre un sellado. Lanza si la clave es incorrecta o el contenido fue alterado. */
function open(key, sealed) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]);
}

/** Deriva una clave de 32 bytes a partir de material de entrada, con sal y contexto. */
function deriveKey(inputKeyMaterial, salt, info) {
  return Buffer.from(crypto.hkdfSync('sha256', inputKeyMaterial, salt, info, KEY_BYTES));
}

module.exports = { randomKey, seal, open, deriveKey, KEY_BYTES };
