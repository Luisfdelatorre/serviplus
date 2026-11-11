const express = require('express');

/**
 * Rutas de licencia.
 * - Mientras el equipo no tenga licencia válida, cualquiera en la LAN puede activarla
 *   (es el primer paso de la instalación).
 * - Con licencia vigente, reactivar o importar exige sesión de administrador
 *   (evita que alguien en la red reemplace la licencia).
 */
function createLicenseRoutes(licenseService) {
  const router = express.Router();

  const requireAdminWhenLicensed = (req, res, next) => {
    const { status } = licenseService.getStatus();
    if (['unlicensed', 'invalid', 'dev'].includes(status)) return next();
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ success: false, error: 'Se requiere sesión de administrador para cambiar la licencia.' });
  };

  const sendError = (res, err) => {
    res.status(err.status || 400).json({ success: false, code: err.code || 'ERROR', error: err.message });
  };

  router.get('/status', (req, res) => {
    res.json({ success: true, data: licenseService.getStatus() });
  });

  router.post('/activate', requireAdminWhenLicensed, async (req, res) => {
    try {
      const data = await licenseService.activate(req.body && req.body.licenseKey);
      res.json({ success: true, data });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/import', requireAdminWhenLicensed, (req, res) => {
    try {
      const data = licenseService.importLicense(req.body && req.body.license);
      res.json({ success: true, data });
    } catch (err) {
      sendError(res, err instanceof SyntaxError ? { status: 400, code: 'BAD_FILE', message: 'El archivo de licencia no es JSON válido.' } : err);
    }
  });

  router.post('/refresh', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Se requiere sesión de administrador.' });
    }
    res.json({ success: true, data: await licenseService.heartbeat() });
  });

  return router;
}

module.exports = { createLicenseRoutes };
