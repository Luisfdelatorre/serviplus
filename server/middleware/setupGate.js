/**
 * Lleva a `/setup` hasta que la configuración de primera ejecución esté completa.
 * Corre DESPUÉS del gate de licencia: solo tiene sentido configurar un equipo con licencia.
 *
 * Deja pasar lo que el propio asistente necesita (setup, licencia, impresoras, login de
 * admin, config pública y estáticos) y bloquea el resto de la API con 409 SETUP_REQUIRED.
 */
const ALLOWED_API_PREFIXES = ['/api/setup', '/api/license', '/api/printer', '/api/config/public', '/api/admin/auth', '/api/backups/restore'];

function isAllowedApi(p) {
  return ALLOWED_API_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function wantsHtmlPage(req) {
  return req.method === 'GET' && !/\.[a-z0-9]+$/i.test(req.path) && String(req.headers.accept || '').includes('text/html');
}

function createSetupGate(setupService) {
  return function setupGate(req, res, next) {
    if (setupService.isComplete()) return next();

    const p = req.path;
    if (p === '/ping' || isAllowedApi(p)) return next();

    if (p.startsWith('/api/')) {
      return res.status(409).json({ success: false, code: 'SETUP_REQUIRED', error: 'El sistema aún no ha sido configurado.' });
    }
    if (wantsHtmlPage(req) && p !== '/setup') return res.redirect(302, '/setup');
    return next();
  };
}

module.exports = { createSetupGate };
