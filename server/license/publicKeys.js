/**
 * Claves públicas Ed25519 que firman licencias y paquetes de actualización.
 * La clave privada correspondiente NUNCA vive en este repositorio.
 * `kid` permite rotar claves sin invalidar licencias ya emitidas.
 */
const PUBLIC_KEYS = {
  'sp-2026-1': `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAmWE9RZnmU4M4Lx4DgC0fJeaP/5CcXXvPIodfohpA/zU=
-----END PUBLIC KEY-----`
};

module.exports = { PUBLIC_KEYS };
