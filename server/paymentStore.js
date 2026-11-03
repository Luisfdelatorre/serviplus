const fs = require('fs');
const path = require('path');

const PAYMENTS_FILE = path.join(__dirname, '..', 'payments_state.dat');

let memoryPayments = {};

// Cargar pagos existentes desde archivo persistente
try {
  if (fs.existsSync(PAYMENTS_FILE)) {
    const raw = fs.readFileSync(PAYMENTS_FILE, 'utf8');
    memoryPayments = JSON.parse(raw);
  }
} catch (e) {
  console.error('[Payment Store] Error al cargar payments_state.dat, iniciando vacío:', e.message);
  memoryPayments = {};
}

function persist() {
  try {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(memoryPayments, null, 2), 'utf8');
  } catch (e) {
    console.error('[Payment Store] Error al guardar payments_state.dat:', e.message);
  }
}

const paymentStore = {
  /**
   * Guarda o actualiza un registro de pago
   */
  savePayment({
    reference,
    transactionId = null,
    orderId = null,
    amount = 0,
    amountInCOP = 0,
    amountInCents = 0,
    status = 'PENDING',
    paymentMethod = 'WOMPI_QR',
    checkoutUrl = null,
    qrId = null,
    customerEmail = null,
    extra = {}
  }) {
    if (!reference) return null;

    const existing = memoryPayments[reference] || {};
    const record = {
      ...existing,
      reference,
      transactionId: transactionId || existing.transactionId || null,
      orderId: orderId || existing.orderId || null,
      amount: amount || existing.amount || 0,
      amountInCOP: amountInCOP || existing.amountInCOP || Math.round(amount * 1000),
      amountInCents: amountInCents || existing.amountInCents || Math.round(amount * 100000),
      status: status || existing.status || 'PENDING',
      paymentMethod: paymentMethod || existing.paymentMethod || 'WOMPI_QR',
      checkoutUrl: checkoutUrl || existing.checkoutUrl || null,
      qrId: qrId || existing.qrId || null,
      customerEmail: customerEmail || existing.customerEmail || null,
      extra: { ...existing.extra, ...extra },
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    memoryPayments[reference] = record;
    persist();
    return record;
  },

  /**
   * Actualiza el estado de un pago por su referencia o por transactionId
   */
  updateStatus(identifier, status, additionalData = {}) {
    let key = identifier;
    let payment = memoryPayments[key];

    // Si no está por referencia, buscar por transactionId
    if (!payment) {
      const found = Object.values(memoryPayments).find((p) => p.transactionId === identifier);
      if (found) {
        key = found.reference;
        payment = found;
      }
    }

    if (!payment) {
      // Si no existe, crear registro base
      return this.savePayment({
        reference: identifier,
        status,
        ...additionalData
      });
    }

    payment.status = status;
    payment.updatedAt = new Date().toISOString();
    if (additionalData && typeof additionalData === 'object') {
      Object.assign(payment, additionalData);
    }

    memoryPayments[key] = payment;
    persist();
    return payment;
  },

  /**
   * Obtiene un pago por su referencia o transactionId
   */
  getPayment(identifier) {
    if (memoryPayments[identifier]) return memoryPayments[identifier];
    return Object.values(memoryPayments).find((p) => p.transactionId === identifier) || null;
  },

  /**
   * Retorna todos los pagos ordenados del más reciente al más antiguo
   */
  getAllPayments(limit = 100) {
    return Object.values(memoryPayments)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }
};

module.exports = paymentStore;
