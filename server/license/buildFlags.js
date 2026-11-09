/**
 * Banderas de build.
 *
 * En código fuente (`npm start`) se permiten overrides de desarrollo (licencia no
 * obligatoria salvo SP_LICENSE_ENFORCE=1, clave pública alternativa, fingerprint simulado).
 * El empaquetado de producción (fase 3) reemplaza este archivo por `PACKAGED = true`,
 * lo que desactiva TODOS los overrides: la licencia siempre se exige.
 */
module.exports = {
  PACKAGED: false
};
