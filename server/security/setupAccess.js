/**
 * Acceso al asistente de configuración antes de terminar la instalación.
 *
 * - Desde el propio equipo (loopback) se permite sin más: es el técnico en el PC del servidor.
 * - Desde la LAN hace falta un token que se crea al primer arranque en `setup-token.txt`, dentro de
 *   la carpeta de datos (solo lo leen los administradores del equipo).
 *
 * Así, un equipo recién instalado en la red no puede ser configurado por cualquiera.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = 'setup-token.txt';
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function tokenPath(dataDir) {
  return path.join(dataDir, TOKEN_FILE);
}

/** Devuelve el token existente o crea uno nuevo (una sola vez por instalación). */
function loadOrCreateSetupToken(dataDir) {
  const file = tokenPath(dataDir);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  fs.mkdirSync(dataDir, { recursive: true });
  const token = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}

function isLoopback(req) {
  const addr = (req.socket && req.socket.remoteAddress) || req.ip || '';
  return LOOPBACK.has(addr);
}

function tokenMatches(req, dataDir) {
  const given = req.headers['x-setup-token'];
  if (!given || !fs.existsSync(tokenPath(dataDir))) return false;
  const expected = Buffer.from(fs.readFileSync(tokenPath(dataDir), 'utf8').trim());
  const actual = Buffer.from(String(given).trim());
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** true si la petición puede tocar la configuración mientras el equipo no está terminado. */
function setupAccessAllowed(req, dataDir) {
  return isLoopback(req) || tokenMatches(req, dataDir);
}

module.exports = { loadOrCreateSetupToken, setupAccessAllowed, isLoopback, tokenMatches, TOKEN_FILE };
