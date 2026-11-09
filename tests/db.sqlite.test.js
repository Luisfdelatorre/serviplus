/**
 * Prueba aldeloService con el driver SQLite sobre una copia temporal de kebab.mdb.
 * Corre en macOS / Linux / Windows sin Access instalado cuando Node >= 22.5.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let hasNodeSqlite = false;
try {
  require('node:sqlite');
  hasNodeSqlite = true;
} catch (e) {
  hasNodeSqlite = false;
}

if (!hasNodeSqlite) {
  test('SQLite driver: omitido (requiere Node.js >= 22.5 con node:sqlite nativo)', { skip: true }, () => {});
} else {
  const ROOT = path.join(__dirname, '..');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serviplus-db-'));
  const tmpDb = path.join(tmpDir, 'test.db');

  execFileSync(process.execPath, [
    path.join(ROOT, 'scripts', 'import-mdb-to-sqlite.js'),
    path.join(ROOT, 'server', 'kebab.mdb'),
    tmpDb,
    '--force'
  ], { stdio: 'ignore' });

  process.env.DB_DRIVER = 'sqlite';
  process.env.SQLITE_PATH = tmpDb;
  const aldeloService = require('../server/aldeloService');

  test.after(() => {
    require('../server/db').connection.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('SQLite driver: selecciona el driver sqlite', () => {
    assert.equal(aldeloService.getDriverName(), 'sqlite');
  });

  test('SQLite driver: getMenu devuelve categorías con productos y modificadores', async () => {
    const menu = await aldeloService.getMenu();
    assert.ok(menu.length > 0, 'debe haber categorías');
    const items = menu.flatMap((c) => c.items);
    assert.ok(items.length > 0, 'debe haber productos');
    for (const item of items) {
      assert.equal(typeof item.price, 'number');
      assert.ok(Array.isArray(item.modifiers));
    }
  });

  test('SQLite driver: empleados, mesas y productos admin', async () => {
    const employees = await aldeloService.getEmployees();
    assert.ok(employees.length > 0);
    assert.equal(employees[0].AccessCode, undefined, 'nunca exponer el PIN');

    const tables = await aldeloService.getTables();
    assert.ok(tables.length > 0);

    const products = await aldeloService.getAllProductsAdmin();
    assert.ok(products.length > 0);
    assert.equal(typeof products[0].isActive, 'boolean');
  });

  test('SQLite driver: setProductAvailability cambia el estado del producto', async () => {
    const [first] = await aldeloService.getAllProductsAdmin();
    await aldeloService.setProductAvailability(first.id, false);
    let updated = (await aldeloService.getAllProductsAdmin()).find((p) => p.id === first.id);
    assert.equal(updated.isActive, false);

    await aldeloService.setProductAvailability(first.id, true);
    updated = (await aldeloService.getAllProductsAdmin()).find((p) => p.id === first.id);
    assert.equal(updated.isActive, true);
  });

  test('SQLite driver: crear orden, cobrarla y leer el recibo', async () => {
    const menu = await aldeloService.getMenu();
    const product = menu.flatMap((c) => c.items)[0];

    const order = await aldeloService.createOrder({
      employeeId: 1,
      orderType: 2,
      items: [{ id: product.id, quantity: 2, price: 999999 }], // precio manipulado: debe ignorarse
      isPaid: false
    });
    assert.ok(order.orderId > 0, 'debe devolver el ID autonumérico');
    assert.equal(order.total, Number((product.price * 2).toFixed(2)), 'el total sale de la BD, no del cliente');
    assert.equal(order.status, '1');

    const active = await aldeloService.getActiveOrders();
    const found = active.find((o) => o.id === order.orderId);
    assert.ok(found, 'la nueva orden aparece en órdenes activas');
    assert.equal(found.items.length, 1);
    assert.ok(!Number.isNaN(Date.parse(found.createdAt)), 'createdAt es una fecha ISO válida');

    const paid = await aldeloService.updateOrderStatus(order.orderId, '2');
    assert.equal(paid.status, '2');

    const receipt = await aldeloService.getOrderReceiptData(order.orderId);
    assert.equal(receipt.orderId, order.orderId);
    assert.equal(receipt.items.length, 1);
    assert.equal(receipt.paymentMethod, '1');
  });

  test('SQLite driver: turno de cajero y pagos de kiosko', async () => {
    assert.equal((await aldeloService.signInCashier({ employeeId: 1, startAmount: 50 })).success, true);
    assert.equal((await aldeloService.signOutCashier({ employeeId: 1, endAmount: 50 })).success, true);

    const ref = `TEST-${Date.now()}`;
    assert.ok(await aldeloService.saveKioskPaymentIntent({ reference: ref, amount: 12.5, cart: [{ id: 1 }] }));
    assert.equal(await aldeloService.updateKioskPaymentStatus(ref, 'APPROVED', { orderId: 7 }), true);

    const payments = await aldeloService.getKioskPayments(5);
    const saved = payments.find((p) => p.Reference === ref);
    assert.ok(saved, 'el pago aparece en la lista');
    assert.equal(saved.PaymentStatus, 'APPROVED');
    assert.equal(saved.OrderID, 7);
  });
}
