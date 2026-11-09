/**
 * Claves públicas Ed25519 que firman licencias y manifiestos de actualización.
 * Cada clave se identifica por su keyId (SHA-256 del DER, 16 hex), igual que en el portal.
 *
 * Producción: la clave del portal del proveedor. Para rotar, añade aquí la nueva ANTES de que el
 * portal empiece a firmar con ella; retira la anterior solo cuando no queden licencias emitidas con ella.
 * La clave privada correspondiente NUNCA vive en este repositorio.
 */
const PUBLIC_KEYS = {
  production: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAoO1jO/JIVT1Ej52ukLGWHuOlC35O43eIsVr6jLyZrPA=
-----END PUBLIC KEY-----`
};

module.exports = { PUBLIC_KEYS };
