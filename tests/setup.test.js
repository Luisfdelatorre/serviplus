const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createSetupService } = require('../server/setup/setupService');
const { createSetupGate } = require('../server/middleware/setupGate');

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

/** configStore falso con la misma semántica de deep-merge que el real. */
function fakeConfigStore(initial = {}) {
  let cfg = initial;
  return {
    ROOT_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sp-setup-')),
    getConfig: () => JSON.parse(JSON.stringify(cfg)),
    saveConfig: (patch) => {
      cfg = deepMerge(cfg, patch);
      return cfg;
    }
  };
}

function makeService({ config = {}, aldelo, seedMdbPath = path.join(__dirname, '..', 'server', 'kebab.mdb') } = {}) {
  const configStore = fakeConfigStore(config);
  const aldeloService = aldelo || { verifyAdminAccess: async () => ({ success: true, employee: { name: 'Gerente' } }) };
  const service = createSetupService({ configStore, aldeloService, seedMdbPath });
  return { service, configStore };
}

test('Setup: fresh install reports all steps pending and not completed', () => {
  const { service } = makeService();
  const status = service.getStatus();
  assert.equal(status.completed, false);
  assert.deepEqual(status.pending, ['database', 'business', 'printer', 'admin']);
});

test('Setup: adodb mode writes connection string and flags restart', async () => {
  const { service, configStore } = makeService();
  const res = await service.applyDatabase({ mode: 'adodb', mdbPath: 'C:\\SP\\B\\kebab.mdb' });
  assert.equal(res.restartRequired, true);
  const db = configStore.getConfig().db;
  assert.equal(db.driver, 'adodb');
  assert.match(db.connectionString, /Data Source=C:\\SP\\B\\kebab.mdb/);
  assert.equal(service.getStatus().steps.database, true);
});

test('Setup: adodb mode without a path or detected file is rejected', async () => {
  const { service } = makeService({ seedMdbPath: '/nonexistent/kebab.mdb' });
  await assert.rejects(service.applyDatabase({ mode: 'adodb', mdbPath: '' }), /kebab\.mdb/);
});

test('Setup: sqlite mode without import sets driver and path', async () => {
  const { service, configStore } = makeService();
  const res = await service.applyDatabase({ mode: 'sqlite' });
  assert.equal(res.mode, 'sqlite');
  assert.equal(res.imported, false);
  assert.equal(configStore.getConfig().db.driver, 'sqlite');
  assert.ok(configStore.getConfig().db.sqlite.path.endsWith(path.join('data', 'serviplus.db')));
});

test('Setup: invalid db mode is rejected', async () => {
  const { service } = makeService();
  await assert.rejects(service.applyDatabase({ mode: 'mysql' }), /inválido/);
});

test('Setup: business requires name and NIT', () => {
  const { service } = makeService();
  assert.throws(() => service.applyBusiness({ name: '', nit: '123' }), /nombre/i);
  assert.throws(() => service.applyBusiness({ name: 'Kebab', nit: '' }), /NIT/);
  const status = service.applyBusiness({ name: 'Kebab', nit: '900-1', address: 'Calle 1' });
  assert.equal(status.steps.business, true);
  assert.equal(status.business.legalName, 'Kebab'); // cae al nombre comercial
});

test('Setup: admin step verifies the PIN against the active DB', async () => {
  const calls = [];
  const aldelo = {
    verifyAdminAccess: async (pin) => {
      calls.push(pin);
      return pin === '4321' ? { success: true, employee: { name: 'Gerente' } } : { success: false, error: 'PIN inválido' };
    }
  };
  const { service } = makeService({ aldelo });
  assert.equal((await service.verifyAdmin('0000')).success, false);
  assert.equal(service.getStatus().steps.admin, false);
  const ok = await service.verifyAdmin('4321');
  assert.equal(ok.success, true);
  assert.equal(service.getStatus().steps.admin, true);
  assert.deepEqual(calls, ['0000', '4321']);
});

test('Setup: complete is blocked until every step is done, then flips completed', async () => {
  const { service } = makeService();
  assert.throws(() => service.complete(), (e) => e.code === 'INCOMPLETE');

  await service.applyDatabase({ mode: 'sqlite' });
  service.applyBusiness({ name: 'Kebab', nit: '900-1' });
  service.markPrinterDone();
  await service.verifyAdmin('4321');

  const status = service.complete();
  assert.equal(status.completed, true);
  assert.ok(status.completedAt);
  assert.equal(service.isComplete(), true);
});

test('Setup: network info exposes mdns and LAN urls with the right port', () => {
  const prev = process.env.PORT;
  process.env.PORT = '8080';
  const { service } = makeService();
  const net = service.networkInfo();
  assert.equal(net.port, 8080);
  assert.equal(net.mdnsUrl, 'http://serviplus.local:8080');
  assert.ok(net.lanUrls.every((u) => u.endsWith(':8080')));
  if (prev === undefined) delete process.env.PORT; else process.env.PORT = prev;
});

function runGate(complete, { method = 'GET', url = '/api/menu', accept = 'application/json' } = {}) {
  const gate = createSetupGate({ isComplete: () => complete });
  const result = { nextCalled: false };
  const req = { method, path: url, headers: { accept } };
  const res = {
    status(code) { result.code = code; return this; },
    json(body) { result.body = body; return this; },
    redirect(code, to) { result.code = code; result.redirect = to; }
  };
  gate(req, res, () => (result.nextCalled = true));
  return result;
}

test('Gate: incomplete setup blocks the API and redirects pages, allows the wizard', () => {
  assert.equal(runGate(false).code, 409);
  assert.equal(runGate(false).body.code, 'SETUP_REQUIRED');
  assert.equal(runGate(false, { url: '/kiosk', accept: 'text/html' }).redirect, '/setup');
  assert.equal(runGate(false, { url: '/setup', accept: 'text/html' }).nextCalled, true);
  assert.equal(runGate(false, { method: 'POST', url: '/api/setup/database' }).nextCalled, true);
  assert.equal(runGate(false, { url: '/api/printer/list' }).nextCalled, true);
  assert.equal(runGate(false, { method: 'POST', url: '/api/admin/auth' }).nextCalled, true);
  assert.equal(runGate(false, { url: '/assets/app.js', accept: '*/*' }).nextCalled, true);
});

test('Gate: once complete everything passes through', () => {
  assert.equal(runGate(true).nextCalled, true);
  assert.equal(runGate(true, { url: '/kiosk', accept: 'text/html' }).nextCalled, true);
});

test('Gate: the activation page is never sent to setup (would loop with the license gate)', () => {
  assert.equal(runGate(false, { url: '/activate', accept: 'text/html' }).nextCalled, true);
  assert.equal(runGate(false, { url: '/activate', accept: 'text/html' }).redirect, undefined);
});
