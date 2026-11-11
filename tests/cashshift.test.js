const test = require('node:test');
const assert = require('node:assert/strict');

const cashShiftService = require('../server/cashShiftService');

/** Aísla el singleton: turnos en memoria y sin escribir cash_shifts.json. */
function freshService() {
  cashShiftService.shifts = [];
  cashShiftService.save = () => {};
  cashShiftService.openShift({ initialCash: 50000 });
  return cashShiftService;
}

test('CashShift: a recorded sale updates the live totals and the expected cash', () => {
  const svc = freshService();
  svc.recordSale({ orderId: 1, total: 12000, paymentMethod: 'CASH' });
  svc.recordSale({ orderId: 2, total: 8000, paymentMethod: 'WOMPI_QR' });
  const { shift } = svc.getCurrentShift();
  assert.equal(shift.sales.totalSales, 20000);
  assert.equal(shift.sales.cashTotal, 12000);
  assert.equal(shift.sales.wompiTotal, 8000);
  assert.equal(shift.sales.ordersCount, 2);
  assert.equal(shift.expectedCashInDrawer, 62000);
});

test('CashShift: the same order is only counted once', () => {
  const svc = freshService();
  svc.recordSale({ orderId: 7, total: 5000, paymentMethod: 'CASH' });
  svc.recordSale({ orderId: 7, total: 5000, paymentMethod: 'CASH' });
  const { shift } = svc.getCurrentShift();
  assert.equal(shift.sales.totalSales, 5000);
  assert.equal(shift.sales.ordersCount, 1);
});

test('CashShift: a sale with no open shift is ignored', () => {
  const svc = freshService();
  svc.closeShift({ actualCashInDrawer: 50000 });
  assert.equal(svc.recordSale({ orderId: 9, total: 1000 }), null);
});
