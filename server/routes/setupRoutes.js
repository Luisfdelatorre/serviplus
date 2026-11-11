const express = require('express');
const appPaths = require('../lib/appPaths');
const { setupAccessAllowed, isLoopback } = require('../security/setupAccess');

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
    const status = ['INCOMPLETE', 'RESTART_REQUIRED'].includes(err.code) ? 409 : 400;
    res.status(status).json({ success: false, code: err.code || 'ERROR', error: err.message });
  };

  router.get('/status', (req, res) => {
    res.json({ success: true, data: setupService.getStatus() });
  });

  router.get('/detect-mdb', guard, (req, res) => {
    res.json({ success: true, data: { found: setupService.detectMdb() } });
  });

  router.get('/browse', guard, (req, res) => {
    try {
      const dir = typeof req.query.dir === 'string' ? req.query.dir : undefined;
      res.json({ success: true, data: setupService.browse(dir) });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Diálogo nativo del sistema: se abre en el escritorio del servidor, así que solo tiene sentido
  // (y solo se permite) para quien configura desde ese mismo equipo.
  router.post('/pick-file', guard, async (req, res) => {
    // "No hay diálogo nativo" no es un error: la interfaz usa el explorador integrado.
    const unavailable = (message, busy = false) => res.json({ success: true, data: { unavailable: true, busy, message } });
    if (!isLoopback(req)) return unavailable('El diálogo del sistema solo está disponible en el equipo del servidor.');
    try {
      res.json({ success: true, data: await setupService.pickNative() });
    } catch (err) {
      if (err.code === 'NATIVE_UNAVAILABLE') return unavailable(err.message);
      if (err.code === 'PICKER_BUSY') return unavailable(err.message, true);
      res.status(500).json({ success: false, code: err.code || 'ERROR', error: err.message });
    }
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
