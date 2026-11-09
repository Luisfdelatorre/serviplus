/**
 * Claves públicas Ed25519 que firman licencias y manifiestos de actualización.
 * Cada clave se identifica por su keyId (SHA-256 del DER, 16 hex), igual que en el portal.
 *
 * ANTES DE PUBLICAR UN RELEASE: reemplazar la clave de abajo por la pública de producción del
 * portal (GET /api/license/public-key). La clave de desarrollo que está aquí no la usa el portal
 * y no debe llegar a clientes.
 * La clave privada correspondiente NUNCA vive en este repositorio.
 */
const PUBLIC_KEYS = {
  'sp-2026-1': `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAmWE9RZnmU4M4Lx4DgC0fJeaP/5CcXXvPIodfohpA/zU=
-----END PUBLIC KEY-----`
};

module.exports = { PUBLIC_KEYS };
