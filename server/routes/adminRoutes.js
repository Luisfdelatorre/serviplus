const express = require('express');
const configStore = require('../config');
const aldeloService = require('../aldeloService');
const paymentStore = require('../paymentStore');
const auditService = require('../auditService');
const { pinRateLimiter, signSessionToken, requireRole } = require('../middleware/auth');

function createAdminRoutes(io) {
  const router = express.Router();

  router.post('/auth', pinRateLimiter, async (req, res) => {
    try {
      const { pin } = req.body || {};
      const result = await aldeloService.verifyAdminAccess(pin);
      if (!result.success) {
        if (req.recordFailedPinAttempt) req.recordFailedPinAttempt();
        return res.status(401).json({ success: false, error: result.error });
      }
      if (req.clearPinAttempts) req.clearPinAttempts();
      const adminEmp = { ...result.employee, role: 'admin', isAdmin: true };
      const token = signSessionToken(adminEmp, '8h');

      auditService.record({
        action: 'ADMIN_LOGIN',
        actor: adminEmp.name || adminEmp.id || 'admin',
        target: 'admin_panel'
      });

      res.json({
        success: true,
        data: {
          token,
          employee: adminEmp
        }
      });
    } catch (err) {
      console.error('Error in /api/admin/auth:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/payments', requireRole('admin', 'cashier'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      let payments = await aldeloService.getKioskPayments(limit);
      if (!payments || payments.length === 0) {
        payments = paymentStore.getAllPayments(limit);
      }
      res.json({ success: true, data: payments });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/config', requireRole('admin'), (req, res) => {
    try {
      res.json({
        success: true,
        data: configStore.getRedactedConfig()
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/config', requireRole('admin'), (req, res) => {
    try {
      const newConfig = req.body;
      if (!newConfig || typeof newConfig !== 'object') {
        return res.status(400).json({ success: false, error: 'Configuración inválida' });
      }
      const updated = configStore.saveConfig(newConfig);

      auditService.record({
        action: 'ADMIN_CONFIG_UPDATE',
        actor: (req.user && req.user.name) || 'admin',
        target: 'config.json',
        details: { sections: Object.keys(newConfig) }
      });

      console.log('[Admin] Configuración actualizada (secretos en .env, ajustes en config.json)');
      // Las pantallas abiertas (caja, kiosco) vuelven a leer la configuración pública sin recargar.
      if (io) io.emit('config:updated');
      res.json({
        success: true,
        data: updated,
        message: 'Configuración actualizada con éxito'
      });
    } catch (err) {
      console.error('Error saving configuration:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/audit', requireRole('admin'), (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 100;
      res.json({
        success: true,
        data: auditService.getLogs(limit)
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createAdminRoutes };
