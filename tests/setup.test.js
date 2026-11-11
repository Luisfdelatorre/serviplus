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

function makeService({ config = {}, aldelo, seedMdbPath = path.join(__dirname, '..', 'server', 'kebab.mdb'), activeDb = null } = {}) {
  const configStore = fakeConfigStore(config);
  const aldeloService = aldelo || { verifyAdminAccess: async () => ({ success: true, employee: { name: 'Gerente' } }) };
  const service = createSetupService({ configStore, aldeloService, seedMdbPath, getActiveDb: () => activeDb });
  return { service, configStore };
}

test('Setup: fresh install reports all steps pending and not completed', () => {
  const { service } = makeService();
  const status = service.getStatus();
  assert.equal(status.completed, false);
  assert.deepEqual(status.pending, ['database', 'business', 'printer', 'admin']);
});

/** Carpeta temporal con un kebab.mdb falso en una ruta con espacios (ubicación personalizada). */
function makeCustomMdb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp mdb '));
  const file = path.join(dir, 'kebab.mdb');
  fs.writeFileSync(file, 'x');
  return { dir, file };
}

test('Setup: adodb mode writes connection string for a custom location and flags restart', async () => {
  const { service, configStore } = makeService();
  const { file } = makeCustomMdb();
  const res = await service.applyDatabase({ mode: 'adodb', mdbPath: `"${file}"` });
  assert.equal(res.restartRequired, true);
  assert.equal(res.mdbPath, file);
  const db = configStore.getConfig().db;
  assert.equal(db.driver, 'adodb');
  assert.equal(db.connectionString, `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${file};`);
  assert.equal(service.getStatus().steps.database, true);
});

test('Setup: adodb mode rejects missing files, wrong extensions and unsafe paths', async () => {
  const { service } = makeService();
  const { dir, file } = makeCustomMdb();
  await assert.rejects(service.applyDatabase({ mode: 'adodb', mdbPath: path.join(dir, 'nope.mdb') }), /No se encontró/);
  fs.writeFileSync(path.join(dir, 'datos.txt'), 'x');
  await assert.rejects(service.applyDatabase({ mode: 'adodb', mdbPath: path.join(dir, 'datos.txt') }), /\.mdb/);
  await assert.rejects(service.applyDatabase({ mode: 'adodb', mdbPath: `${file};Mode=Share` }), /no permitidos/);
  await assert.rejects(service.applyDatabase({ mode: 'adodb', mdbPath: dir }), /\.mdb/);
});

test('Setup: browse lists subfolders and .mdb files only, folders first, and reports the parent', () => {
  const { service } = makeService();
  const { dir } = makeCustomMdb();
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'notas.txt'), 'x');
  fs.writeFileSync(path.join(dir, '.oculto.mdb'), 'x');
  const listing = service.browse(dir);
  assert.equal(listing.path, dir);
  assert.equal(listing.parent, path.dirname(dir));
  assert.deepEqual(listing.entries.map((e) => [e.name, e.type]), [['sub', 'dir'], ['kebab.mdb', 'file']]);
  assert.throws(() => service.browse(path.join(dir, 'no-existe')), /No se pudo abrir/);
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

test('Setup: switching the database needs a restart before the PIN check or completion', async () => {
  // Configurado SQLite, pero el servicio sigue corriendo con Aldelo (adodb): hay que reiniciar.
  const { service } = makeService({ config: { db: { driver: 'sqlite' } }, activeDb: 'adodb' });
  assert.equal(service.getStatus().restartPending, true);
  await assert.rejects(service.verifyAdmin('4321'), (e) => e.code === 'RESTART_REQUIRED');
  assert.throws(() => service.complete(), (e) => e.code === 'RESTART_REQUIRED');
});

test('Setup: once the saved mode is running, the restart is no longer pending', async () => {
  const { service } = makeService({ config: { db: { driver: 'sqlite' } }, activeDb: 'sqlite' });
  assert.equal(service.getStatus().restartPending, false);
  const res = await service.verifyAdmin('4321');
  assert.equal(res.success, true);
});

test('Setup: dev bypass reports the wizard as complete without touching the saved config', () => {
  const configStore = fakeConfigStore({});
  const service = createSetupService({ configStore, aldeloService: {}, bypass: true });
  assert.equal(service.isComplete(), true);
  assert.equal(service.getStatus().completed, true);
  assert.equal(service.getStatus().bypassed, true);
  assert.equal(configStore.getConfig().setup, undefined);
});

const { pickFile } = require('../server/setup/nativeFilePicker');

/** execFile falso: responde lo que se le indique al terminar el "diálogo". */
const fakeExec = (err, stdout = '', stderr = '') => (_file, _args, _opts, cb) => cb(err, stdout, stderr);

test('Native picker: returns the chosen path on each platform', async () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    const res = await pickFile({ platform, exec: fakeExec(null, 'C:\\Datos Aldelo\\kebab.mdb\n') });
    assert.deepEqual(res, { path: 'C:\\Datos Aldelo\\kebab.mdb' });
  }
});

test('Native picker: closing the dialog is a cancellation, not an error', async () => {
  assert.deepEqual(await pickFile({ platform: 'win32', exec: fakeExec(Object.assign(new Error('x'), { code: 1 })) }), { cancelled: true });
  assert.deepEqual(await pickFile({ platform: 'linux', exec: fakeExec(Object.assign(new Error('x'), { code: 1 })) }), { cancelled: true });
  assert.deepEqual(
    await pickFile({ platform: 'darwin', exec: fakeExec(Object.assign(new Error('x'), { code: 1 }), '', 'execution error: User canceled. (-128)') }),
    { cancelled: true }
  );
});

test('Native picker: no desktop or missing command is reported as unavailable', async () => {
  await assert.rejects(pickFile({ platform: 'win32', exec: fakeExec(Object.assign(new Error('x'), { code: 2 })) }), (e) => e.code === 'NATIVE_UNAVAILABLE' && /escritorio/.test(e.message));
  await assert.rejects(pickFile({ platform: 'linux', exec: fakeExec(Object.assign(new Error('x'), { code: 'ENOENT' })) }), (e) => e.code === 'NATIVE_UNAVAILABLE');
  await assert.rejects(pickFile({ platform: 'darwin', exec: fakeExec(Object.assign(new Error('x'), { killed: true })) }), (e) => e.code === 'NATIVE_UNAVAILABLE');
});

test('Setup: pickNative proxies the dialog and refuses a second one while it is open', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const configStore = fakeConfigStore({});
  const service = createSetupService({
    configStore,
    aldeloService: {},
    seedMdbPath: '/nonexistent/kebab.mdb',
    pickFile: async () => { await gate; return { path: '/datos/kebab.mdb' }; }
  });
  const first = service.pickNative();
  await assert.rejects(service.pickNative(), (e) => e.code === 'PICKER_BUSY');
  release();
  assert.deepEqual(await first, { path: '/datos/kebab.mdb' });
  release();
  assert.deepEqual(await service.pickNative(), { path: '/datos/kebab.mdb' });
});
