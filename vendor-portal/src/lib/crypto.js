/**
 * Criptografía del servidor de licencias (solo node:crypto, sin dependencias).
 *  - Firma Ed25519 de licencias (.lic) y manifiestos de actualización.
 *  - JSON canónico (claves ordenadas) para que la firma sea reproducible en la app.
 *  - AES-256-GCM para cifrar en reposo las claves de envoltura del escrow.
 */
import crypto from 'node:crypto';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Ejecuta: npm run keys:generate`);
  return v;
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

let cachedPrivate;
let cachedPublic;

function signingPrivateKey() {
  cachedPrivate ||= crypto.createPrivateKey({
    key: Buffer.from(requireEnv('LICENSE_SIGNING_PRIVATE_KEY'), 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  return cachedPrivate;
}

export function signingPublicKey() {
  cachedPublic ||= crypto.createPublicKey(signingPrivateKey());
  return cachedPublic;
}

export function publicKeyInfo() {
  const der = signingPublicKey().export({ format: 'der', type: 'spki' });
  return {
    algorithm: 'Ed25519',
    spkiBase64: der.toString('base64'),
    pem: signingPublicKey().export({ format: 'pem', type: 'spki' }).toString(),
    keyId: sha256Hex(der).slice(0, 16)
  };
}

export function signPayload(payload) {
  const data = Buffer.from(canonicalJson(payload), 'utf8');
  return crypto.sign(null, data, signingPrivateKey()).toString('base64');
}

export function verifyPayload(payload, signatureB64) {
  const data = Buffer.from(canonicalJson(payload), 'utf8');
  return crypto.verify(null, data, signingPublicKey(), Buffer.from(signatureB64, 'base64'));
}

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomBytes(n = 32) {
  return crypto.randomBytes(n);
}

function escrowMasterKey() {
  const key = Buffer.from(requireEnv('ESCROW_MASTER_KEY'), 'base64');
  if (key.length !== 32) throw new Error('ESCROW_MASTER_KEY debe tener 32 bytes (base64)');
  return key;
}

/** Cifra con la clave maestra. Formato: base64(iv | tag | ciphertext). */
export function sealWithMaster(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', escrowMasterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function openWithMaster(sealedB64) {
  const buf = Buffer.from(sealedB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', escrowMasterKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

/** Clave de licencia legible: SVP-XXXXX-XXXXX-XXXXX-XXXXX (sin caracteres ambiguos). */
export function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos: sin sesgo con % 32
  const bytes = crypto.randomBytes(20);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `SVP-${chars.match(/.{5}/g).join('-')}`;
}

export function normalizeLicenseKey(key) {
  return String(key || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function hashLicenseKey(key) {
  return sha256Hex(normalizeLicenseKey(key));
}

/** Hash de contraseña con scrypt. Formato: scrypt$N$r$p$salt$hash */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');
}

export function verifyPassword(password, stored) {
  const [scheme, N, r, p, saltB64, hashB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p)
  });
  return crypto.timingSafeEqual(expected, actual);
}
