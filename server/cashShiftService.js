/**
 * Servicio de Gestión de Turnos de Caja (Apertura, Arqueo en Vivo y Cierre Z)
 * Persiste los turnos en cash_shifts.json para total control operativo y auditoría
 */

const path = require('path');
const { writeJsonAtomic, readJsonSafe } = require('./lib/atomicFile');

const SHIFTS_FILE = path.join(__dirname, '../cash_shifts.json');

class CashShiftService {
  constructor() {
    this.shifts = [];
    this.load();
  }

  load() {
    const loaded = readJsonSafe(SHIFTS_FILE, []);
    this.shifts = Array.isArray(loaded) ? loaded : [];
  }

  save() {
    try {
      writeJsonAtomic(SHIFTS_FILE, this.shifts);
    } catch (err) {
      console.error('[CashShiftService] Error guardando cash_shifts.json:', err.message);
    }
  }

  /**
   * Obtiene el turno actualmente abierto con sus totales en vivo
   */
  getCurrentShift() {
    const openShift = this.shifts.find((s) => s.status === 'OPEN');
    if (!openShift) {
      return {
        isOpen: false,
        shift: null
      };
    }

    const expectedCash = (openShift.initialCash || 0) + (openShift.sales?.cashTotal || 0);
    return {
      isOpen: true,
      shift: {
        ...openShift,
        expectedCashInDrawer: expectedCash
      }
    };
  }

  /**
   * Abre un nuevo turno de caja
   */
  openShift({ cashierId = 1, cashierName = 'Cajero Principal', initialCash = 0, notes = '' }) {
    const existing = this.shifts.find((s) => s.status === 'OPEN');
    if (existing) {
      throw new Error(`Ya existe un turno de caja abierto (#${existing.shiftNumber}) desde ${existing.openedAt}`);
    }

    const shiftNumber = this.shifts.length + 1;
    const newShift = {
      id: `SHIFT-${Date.now()}`,
      shiftNumber,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      closedAt: null,
      cashierId: Number(cashierId) || 1,
      cashierName: String(cashierName || 'Cajero Principal'),
      initialCash: Number(initialCash) || 0,
      openingNotes: String(notes || ''),
      sales: {
        cashTotal: 0,
        wompiTotal: 0,
        cardTotal: 0,
        otherTotal: 0,
        totalSales: 0,
        ordersCount: 0
      },
      orders: [],
      closing: null
    };

    this.shifts.unshift(newShift);
    this.save();
    console.log(`[CashShiftService] 🟢 Turno #${shiftNumber} abierto por ${newShift.cashierName} con base inicial $${newShift.initialCash}`);
    return newShift;
  }

  /**
   * Registra una venta completada en el turno activo
   */
  recordSale({ orderId, total = 0, paymentMethod = 'CASH', details = {} }) {
    const openShift = this.shifts.find((s) => s.status === 'OPEN');
    if (!openShift) {
      console.warn(`[CashShiftService] Venta de orden #${orderId} no asociada a turno (caja cerrada)`);
      return null;
    }

    // Una orden se cuenta una sola vez (p. ej. creada pagada y luego marcada como liquidada).
    if (Array.isArray(openShift.orders) && openShift.orders.some((o) => String(o.orderId) === String(orderId))) {
      return openShift;
    }

    const amount = Number(total) || 0;
    const method = String(paymentMethod || 'CASH').toUpperCase();

    if (!openShift.sales) {
      openShift.sales = { cashTotal: 0, wompiTotal: 0, cardTotal: 0, otherTotal: 0, totalSales: 0, ordersCount: 0 };
    }

    if (method.includes('CASH') || method.includes('EFECTIVO')) {
      openShift.sales.cashTotal += amount;
    } else if (method.includes('WOMPI') || method.includes('QR') || method.includes('TRANSFER')) {
      openShift.sales.wompiTotal += amount;
    } else if (method.includes('CARD') || method.includes('TARJETA') || method.includes('DATAFONO')) {
      openShift.sales.cardTotal += amount;
    } else {
      openShift.sales.otherTotal += amount;
    }

    openShift.sales.totalSales += amount;
    openShift.sales.ordersCount += 1;

    if (!Array.isArray(openShift.orders)) openShift.orders = [];
    openShift.orders.push({
      orderId,
      amount,
      method,
      time: new Date().toISOString(),
      customer: details.customer || ''
    });

    this.save();
    console.log(`[CashShiftService] Venta registrada en turno #${openShift.shiftNumber}: +$${amount} (${method}). Total Ventas: $${openShift.sales.totalSales}`);
    return openShift;
  }

  /**
   * Cierra el turno de caja (Corte Z / Arqueo Final)
   */
  closeShift({ actualCashInDrawer = 0, closedBy = '', notes = '' }) {
    const openShift = this.shifts.find((s) => s.status === 'OPEN');
    if (!openShift) {
      throw new Error('No hay ningún turno de caja abierto para cerrar');
    }

    const actualCash = Number(actualCashInDrawer) || 0;
    const expectedCash = (openShift.initialCash || 0) + (openShift.sales?.cashTotal || 0);
    const difference = actualCash - expectedCash; // positivo = sobrante, negativo = faltante

    openShift.status = 'CLOSED';
    openShift.closedAt = new Date().toISOString();
    openShift.closing = {
      actualCashInDrawer: actualCash,
      expectedCashInDrawer: expectedCash,
      difference: difference,
      statusDifference: difference === 0 ? 'EXACTO' : (difference > 0 ? 'SOBRANTE' : 'FALTANTE'),
      closedBy: String(closedBy || openShift.cashierName),
      closingNotes: String(notes || '')
    };

    this.save();
    console.log(`[CashShiftService] 🔴 Turno #${openShift.shiftNumber} cerrado. Esperado: $${expectedCash}, Entregado: $${actualCash}, Dif: $${difference}`);
    return openShift;
  }

  /**
   * Historial de turnos
   */
  getHistory(limit = 30) {
    return this.shifts.slice(0, limit);
  }
}

module.exports = new CashShiftService();
