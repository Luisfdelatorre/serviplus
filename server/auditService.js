const path = require('path');
const { writeJsonAtomic, readJsonSafe } = require('./lib/atomicFile');

const AUDIT_FILE = path.join(__dirname, '../audit_log.json');
const MAX_AUDIT_ENTRIES = 1000;

class AuditService {
  constructor() {
    this.logs = readJsonSafe(AUDIT_FILE, []);
    if (!Array.isArray(this.logs)) {
      this.logs = [];
    }
  }

  /**
   * Registra un evento sensible en la bitácora de auditoría POS
   * @param {object} params
   * @param {string} params.action - Ej: 'SHIFT_OPEN', 'SHIFT_CLOSE', 'ORDER_VOID', 'PRODUCT_TOGGLE', 'DRAWER_OPEN', 'CONFIG_UPDATE'
   * @param {string|number} [params.actor] - Usuario/empleado que ejecutó la acción
   * @param {string|number} [params.target] - ID de recurso afectado (orden, turno, producto)
   * @param {object} [params.details] - Metadatos adicionales
   */
  record({ action, actor = 'system', target = null, details = {} }) {
    const entry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action: String(action || 'UNKNOWN'),
      actor: String(actor || 'system'),
      target: target !== null && target !== undefined ? String(target) : null,
      details: details && typeof details === 'object' ? details : {}
    };

    this.logs.unshift(entry);
    if (this.logs.length > MAX_AUDIT_ENTRIES) {
      this.logs = this.logs.slice(0, MAX_AUDIT_ENTRIES);
    }

    try {
      writeJsonAtomic(AUDIT_FILE, this.logs);
    } catch (err) {
      console.error('[AuditService] Error persistiendo audit_log.json:', err.message);
    }

    return entry;
  }

  getLogs(limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
    return this.logs.slice(0, safeLimit);
  }
}

module.exports = new AuditService();
