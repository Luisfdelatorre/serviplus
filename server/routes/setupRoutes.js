const express = require('express');

/**
 * Rutas del asistente de configuración.
 * - Mientras el setup no esté completo, cualquiera en la LAN puede completarlo
 *   (es el técnico instalando en sitio).
 * - Una vez completo, re-ejecutar o cambiar algo exige sesión de administrador.
 */
function createSetupRoutes(setupService) {
  const router = express.Router();

  const guard = (req, res, next) => {
    if (!setupService.isComplete()) return next();
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ success: false, error: 'La configuración ya está completa. Inicia sesión como administrador para cambiarla.' });
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
