const express = require('express');
const { requireAdminSession } = require('../middleware/auth');
const { restoreFromBackup } = require('../security/restore');
const { setupAccessAllowed } = require('../security/setupAccess');
const appPaths = require('../lib/appPaths');

/**
 * Respaldos y restauración. Durante la configuración inicial (equipo nuevo) restaurar exige el
 * mismo acceso que el asistente (equipo local o token); una vez configurado, administrador.
 * La llave de restauración la entrega el servidor de licencias solo si está autorizada.
 */
function createBackupRoutes({ backupService, licenseService, dbDriver, isSetupComplete }) {
  const router = express.Router();

  const sendError = (res, err) => {
    res.status(err.status || (err.code === 'BAD_BACKUP' ? 400 : 500)).json({ success: false, code: err.code || 'ERROR', error: err.message });
  };

  const restoreAccess = (req, res, next) => {
    if (!isSetupComplete()) {
      if (setupAccessAllowed(req, appPaths.DATA_DIR)) return next();
      return res.status(403).json({ success: false, code: 'SETUP_TOKEN_REQUIRED', error: 'Introduce el token de configuración del equipo.' });
    }
    return requireAdminSession(req, res, next);
  };

  router.get('/', requireAdminSession, (req, res) => {
    res.json({ success: true, data: { backups: backupService.list() } });
  });

  router.post('/run', requireAdminSession, (req, res) => {
    try {
      res.json({ success: true, data: { file: backupService.runBackup() } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/restore', restoreAccess, async (req, res) => {
    try {
      if (dbDriver.name !== 'sqlite') {
        return res.status(409).json({ success: false, code: 'BACKUP_UNSUPPORTED', error: 'La restauración solo aplica al modo SQLite.' });
      }
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
