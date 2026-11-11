/**
 * Bloquea el sistema según el estado de la licencia.
 *
 * - Sin licencia / inválida: solo se permite activar. Las páginas redirigen a `/activate`
 *   y la API responde 403 `LICENSE_REQUIRED`.
 * - Bloqueada (fin de la gracia): solo se rechazan pedidos y cobros NUEVOS.
 * - El webhook de Wompi siempre pasa: el dinero ya se movió y hay que registrarlo.
 */
const ALWAYS_ALLOWED_API = ['/api/license', '/api/payments/wompi/webhook'];
const NEW_ORDER_ROUTES = [
  ['POST', /^\/api\/orders\/?$/],
  ['POST', /^\/api\/payments\/wompi\/(qr|intent)\/?$/]
];

function isAlwaysAllowed(p) {
  return ALWAYS_ALLOWED_API.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)) || p === '/ping';
}

function wantsHtmlPage(req) {
  return req.method === 'GET' && !/\.[a-z0-9]+$/i.test(req.path) && String(req.headers.accept || '').includes('text/html');
}

function createLicenseGate(licenseService) {
  return function licenseGate(req, res, next) {
    const p = req.path;
    if (isAlwaysAllowed(p)) return next();

    const status = licenseService.getStatus();

    if (!status.allowed) {
      if (p.startsWith('/api/')) {
        return res.status(403).json({ success: false, code: 'LICENSE_REQUIRED', error: status.message });
      }
      if (wantsHtmlPage(req) && p !== '/activate') return res.redirect(302, '/activate');
      return next();
    }

    if (status.blocksNewOrders && NEW_ORDER_ROUTES.some(([m, re]) => m === req.method && re.test(p))) {
      return res.status(403).json({ success: false, code: 'LICENSE_BLOCKED', error: status.message });
    }
    return next();
  };
}

module.exports = { createLicenseGate };
