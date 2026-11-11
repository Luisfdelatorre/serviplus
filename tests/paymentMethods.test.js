const test = require('node:test');
const assert = require('node:assert/strict');

// El cliente es ESM; el helper es puro, así que se importa tal cual.
const load = () => import('../client/src/shared/paymentMethods.js');

test('Payment methods: every method is enabled when the config has no flags', async () => {
  const { getEnabledPaymentMethods } = await load();
  assert.deepEqual(getEnabledPaymentMethods(undefined), ['CASH', 'CARD', 'WOMPI_QR']);
  assert.deepEqual(getEnabledPaymentMethods({}), ['CASH', 'CARD', 'WOMPI_QR']);
});

test('Payment methods: only cash active hides card and QR', async () => {
  const { getEnabledPaymentMethods } = await load();
  assert.deepEqual(getEnabledPaymentMethods({ cash: true, wompiLink: false, bancolombiaQr: false }), ['CASH']);
});

test('Payment methods: each admin flag controls its own method', async () => {
  const { getEnabledPaymentMethods } = await load();
  assert.deepEqual(getEnabledPaymentMethods({ cash: false }), ['CARD', 'WOMPI_QR']);
  assert.deepEqual(getEnabledPaymentMethods({ wompiLink: false }), ['CASH', 'WOMPI_QR']);
  assert.deepEqual(getEnabledPaymentMethods({ bancolombiaQr: false }), ['CASH', 'CARD']);
});

test('Payment methods: disabling everything falls back to cash so sales are never blocked', async () => {
  const { getEnabledPaymentMethods } = await load();
  assert.deepEqual(getEnabledPaymentMethods({ cash: false, wompiLink: false, bancolombiaQr: false }), ['CASH']);
});

test('Payment methods: a disabled selection moves to the first enabled candidate', async () => {
  const { resolvePaymentMethod } = await load();
  assert.equal(resolvePaymentMethod(['CASH'], 'WOMPI_QR'), 'CASH');
  assert.equal(resolvePaymentMethod(['CASH', 'CARD'], 'CARD'), 'CARD');
  assert.equal(resolvePaymentMethod(['CASH', 'WOMPI_QR'], 'CARD', ['WOMPI_QR', 'CASH', 'CARD']), 'WOMPI_QR');
});
