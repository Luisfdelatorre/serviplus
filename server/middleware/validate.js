/**
 * Validadores de entrada ligeros para endpoints críticos del POS.
 */

function validateOrderPayload(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Payload de orden inválido' });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ success: false, error: 'La orden debe incluir al menos un ítem' });
  }
  if (body.items.length > 200) {
    return res.status(400).json({ success: false, error: 'Demasiados ítems en una sola orden' });
  }
  for (const item of body.items) {
    const id = Number(item && (item.id || item.menuItemId));
    const qty = Number(item && item.quantity !== undefined ? item.quantity : 1);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Cada ítem debe tener un ID de producto válido' });
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
      return res.status(400).json({ success: false, error: 'Cantidad de ítem fuera de rango (1-999)' });
    }
  }
  next();
}

function validateOrderStatusPayload(req, res, next) {
  const { status } = req.body || {};
  if (!['1', '2', '3', 1, 2, 3].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Estado de orden inválido (valores permitidos: 1=Abierta, 2=Pagada, 3=Anulada)'
    });
  }
  req.body.status = String(status);
  next();
}

function validateKdsStatusPayload(req, res, next) {
  const { kdsStatus } = req.body || {};
  const allowed = ['WAITING_PAYMENT', 'PREPARING', 'PENDING', 'COOKING', 'READY', 'SERVED'];
  if (!kdsStatus || !allowed.includes(String(kdsStatus).toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: `Estado KDS inválido. Permitidos: ${allowed.join(', ')}`
    });
  }
  req.body.kdsStatus = String(kdsStatus).toUpperCase();
  next();
}

function validateShiftOpenPayload(req, res, next) {
  const { initialCash } = req.body || {};
  const amount = Number(initialCash ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ success: false, error: 'Monto inicial de apertura inválido' });
  }
  next();
}

module.exports = {
  validateOrderPayload,
  validateOrderStatusPayload,
  validateKdsStatusPayload,
  validateShiftOpenPayload
};

