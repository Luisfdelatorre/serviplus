const express = require('express');
const { requireRole } = require('../middleware/auth');

/** Rutas de actualización (solo administrador). Nunca aplican sin una petición explícita. */
function createUpdateRoutes(updateService) {
  const router = express.Router();

  const sendError = (res, err) => {
    res.status(err.status || 500).json({ success: false, code: err.code || 'ERROR', error: err.message });
  };

  router.get('/status', requireRole('admin'), (req, res) => {
    res.json({ success: true, data: updateService.getStatus() });
  });

  router.post('/check', requireRole('admin'), async (req, res) => {
    try {
      res.json({ success: true, data: await updateService.check() });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/apply', requireRole('admin'), async (req, res) => {
    try {
      const data = await updateService.apply();
      res.status(202).json({ success: true, data, message: 'La actualización comenzó. El sistema se reiniciará en unos minutos.' });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { createUpdateRoutes };
