const express = require('express');
const appPaths = require('../lib/appPaths');
const { setupAccessAllowed } = require('../security/setupAccess');

/**
 * Rutas del asistente de configuración.
 * - Mientras el setup no esté completo, solo el propio equipo o quien tenga el token de
 *   `setup-token.txt` puede configurarlo (ver setupAccess.js).
 * - Una vez completo, cambiar algo exige sesión de administrador.
 */
function createSetupRoutes(setupService) {
  const router = express.Router();

  const guard = (req, res, next) => {
    if (!setupService.isComplete()) {
      if (setupAccessAllowed(req, appPaths.DATA_DIR)) return next();
      return res.status(403).json({ success: false, code: 'SETUP_TOKEN_REQUIRED', error: 'Introduce el token de configuración del equipo.' });
    }
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ success: false, code: 'FORBIDDEN', error: 'La configuración ya está completa. Inicia sesión como administrador para cambiarla.' });
  };

  const sendError = (res, err) => {
    const status = err.code === 'INCOMPLETE' ? 409 : 400;
    res.status(status).json({ success: false, code: err.code || 'ERROR', error: err.message });
  };

  router.get('/status', (req, res) => {
    res.json({ success: true, data: setupService.getStatus() });
  });

  router.get('/detect-mdb', guard, (req, res) => {
    res.json({ success: true, data: { found: setupService.detectMdb() } });
  });

  router.post('/database', guard, async (req, res) => {
    try {
      const data = await setupService.applyDatabase(req.body || {});
      res.json({ success: true, data });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/business', guard, (req, res) => {
    try {
      res.json({ success: true, data: setupService.applyBusiness(req.body || {}) });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/printer-done', guard, (req, res) => {
    res.json({ success: true, data: setupService.markPrinterDone() });
  });

  router.post('/verify-admin', guard, async (req, res) => {
    try {
      const result = await setupService.verifyAdmin(req.body && req.body.pin);
      res.status(result.success ? 200 : 401).json(result.success ? { success: true, data: result } : { success: false, error: result.error });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/complete', guard, (req, res) => {
    try {
      res.json({ success: true, data: setupService.complete() });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { createSetupRoutes };
