const express = require('express');
const { requireRole } = require('../middleware/auth');
const { restoreFromBackup } = require('../security/restore');

/**
 * Respaldos y restauración. Durante la configuración inicial (equipo nuevo) cualquiera en la LAN
 * puede restaurar; una vez configurado, exige administrador. La llave de restauración la entrega
 * el servidor de licencias solo si está autorizada.
 */
function createBackupRoutes({ backupService, licenseService, dbDriver, isSetupComplete }) {
  const router = express.Router();

  const sendError = (res, err) => {
    res.status(err.status || (err.code === 'BAD_BACKUP' ? 400 : 500)).json({ success: false, code: err.code || 'ERROR', error: err.message });
  };

  const adminAfterSetup = (req, res, next) => {
    if (!isSetupComplete()) return next();
    return requireRole('admin')(req, res, next);
  };

  router.get('/', requireRole('admin'), (req, res) => {
    res.json({ success: true, data: { backups: backupService.list() } });
  });

  router.post('/run', requireRole('admin'), (req, res) => {
    try {
      res.json({ success: true, data: { file: backupService.runBackup() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/restore', adminAfterSetup, async (req, res) => {
    try {
      const { license } = licenseService.getStatus();
      if (!license) {
        return res.status(409).json({ success: false, code: 'LICENSE_REQUIRED', error: 'Activa la licencia antes de restaurar un respaldo.' });
      }
      const data = await restoreFromBackup({
        backups: backupService,
        backupFile: req.body && req.body.backupFile,
        dbPath: dbDriver.source,
        licenseId: license.licenseId,
        fetchEscrowKey: licenseService.fetchEscrowKey
      });
      res.json({ success: true, data, message: 'Respaldo listo. Reinicia el servicio Serviplus para aplicarlo.' });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { createBackupRoutes };
