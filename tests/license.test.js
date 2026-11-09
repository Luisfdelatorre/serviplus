const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { signDocument, verifyDocument, canonicalJson } = require('../server/license/signing');
const { buildFingerprint, matchFingerprint, machineCode } = require('../server/license/fingerprint');
const { createLicenseService, GRACE_MS } = require('../server/license/licenseService');
const { createLicenseGate } = require('../server/middleware/licenseGate');

// Clave de prueba: se registra como clave pública de desarrollo (override permitido en código fuente).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-license-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const PRIV = privateKey.export({ type: 'pkcs8', format: 'pem' });
fs.writeFileSync(path.join(tmp, 'pub.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
process.env.SP_LICENSE_PUBLIC_KEY_FILE = path.join(tmp, 'pub.pem');
process.env.SP_LICENSE_PUBLIC_KEY_KID = 'test';

const RAW = { board: 'UUID-1234', machine: 'GUID-ABCD', disk: 'DISK-9', cpu: 'CPU-77' };
const FP = buildFingerprint(RAW);

function makeLicense(overrides = {}) {
  return signDocument(
    {
      v: 1,
      product: 'serviplus',
      licenseId: 'LIC-TEST',
      restaurantId: 'R1',
      fingerprint: FP,
      issuedAt: new Date().toISOString(),
      expiresAt: null,
      features: [],
      channel: 'stable',
      ...overrides
    },
    PRIV,
    'test'
  );
}

function makeService({ fp = FP, clock, fetchImpl } = {}) {
  const dataDir = fs.mkdtempSync(path.join(tmp, 'data-'));
  let t = clock || Date.now();
  const service = createLicenseService({
    dataDir,
    fingerprint: () => fp,
    now: () => t,
    fetchImpl,
    getConfig: () => ({ license: { serverUrl: 'http://license.test', supportContact: '300 000 0000' } })
  });
  return { service, dataDir, advance: (ms) => (t += ms) };
}

test.beforeEach(() => {
  process.env.SP_LICENSE_ENFORCE = '1';
});

test('License: canonical JSON is key-order independent', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
});

test('License: signature verifies and any tampering breaks it', () => {
  const doc = makeLicense();
  assert.equal(verifyDocument(doc), true);
  const tampered = JSON.parse(JSON.stringify(doc));
  tampered.payload.expiresAt = '2099-01-01T00:00:00.000Z';
  assert.equal(verifyDocument(tampered), false);
  assert.equal(verifyDocument({ ...doc, kid: 'unknown' }), false);
});

test('License: a license signed by a foreign key is rejected', () => {
  const foreign = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
  const doc = signDocument(makeLicense().payload, foreign, 'test');
  assert.equal(verifyDocument(doc), false);
});

test('Fingerprint: 3 of 4 matching survives a disk swap, a clone does not', () => {
  const diskSwap = buildFingerprint({ ...RAW, disk: 'NEW-DISK' });
  assert.equal(matchFingerprint(FP, diskSwap).ok, true);

  const twoChanged = buildFingerprint({ ...RAW, disk: 'NEW-DISK', board: 'NEW-BOARD' });
  assert.equal(matchFingerprint(FP, twoChanged).ok, false);

  const otherPc = buildFingerprint({ board: 'X', machine: 'Y', disk: 'Z', cpu: 'W' });
  assert.equal(matchFingerprint(FP, otherPc).ok, false);
});

test('Fingerprint: bogus vendor values are ignored and machine code is stable', () => {
  const fp = buildFingerprint({ board: 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF', machine: 'To be filled by O.E.M.', disk: '', cpu: 'CPU' });
  assert.equal(fp.boardUuid, null);
  assert.equal(fp.machineGuid, null);
  assert.equal(fp.diskSerial, null);
  assert.match(machineCode(FP), /^SP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(machineCode(FP), machineCode(buildFingerprint(RAW)));
});

test('Service: dev mode when enforcement is off', () => {
  delete process.env.SP_LICENSE_ENFORCE;
  const { service } = makeService();
  assert.equal(service.getStatus().status, 'dev');
  assert.equal(service.getStatus().allowed, true);
});

test('Service: unlicensed → import → valid; copied to another PC → invalid', () => {
  const { service, dataDir } = makeService();
  assert.equal(service.getStatus().status, 'unlicensed');

  const status = service.importLicense(JSON.stringify(makeLicense()));
  assert.equal(status.status, 'valid');
  assert.equal(status.license.licenseId, 'LIC-TEST');

  // Simula copiar la carpeta de datos a otro PC.
  const otherFp = buildFingerprint({ board: 'X', machine: 'Y', disk: 'Z', cpu: 'W' });
  const clone = createLicenseService({ dataDir, fingerprint: () => otherFp, getConfig: () => ({}) });
  const cloned = clone.getStatus();
  assert.equal(cloned.status, 'invalid');
  assert.equal(cloned.reason, 'MACHINE_MISMATCH');
  assert.equal(cloned.allowed, false);
});

test('Service: importing a license for another machine is refused', () => {
  const { service } = makeService();
  const foreignFp = buildFingerprint({ board: 'X', machine: 'Y', disk: 'Z', cpu: 'W' });
  assert.throws(() => service.importLicense(makeLicense({ fingerprint: foreignFp })), /otro equipo/);
  assert.equal(service.getStatus().status, 'unlicensed');
});

test('Service: hand-edited license file on disk → invalid', () => {
  const { service, dataDir } = makeService();
  service.importLicense(makeLicense());
  const file = path.join(dataDir, 'license.lic');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  doc.payload.features = ['everything'];
  fs.writeFileSync(file, JSON.stringify(doc));
  const fresh = createLicenseService({ dataDir, fingerprint: () => FP, getConfig: () => ({}) });
  assert.equal(fresh.getStatus().reason, 'TAMPERED');
});

test('Service: online activation stores the signed license', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({ lic: makeLicense(), seatId: 'seat-1', escrow: { alg: 'aes-256-gcm', wrapKey: 'AAAA', stored: false } }) };
  };
  const { service } = makeService({ fetchImpl });
  const status = await service.activate('sp-abcd-1234');
  assert.equal(status.status, 'valid');
  assert.equal(calls[0].url, 'http://license.test/api/license/activate');
  assert.equal(calls[0].body.licenseKey, 'SP-ABCD-1234');
  assert.deepEqual(calls[0].body.fingerprint, FP);
});

test('Service: activation surfaces the portal error message', async () => {
  const rejecting = async () => ({ ok: false, status: 404, json: async () => ({ error: 'invalid_license_key', message: 'Clave de licencia no válida' }) });
  await assert.rejects(makeService({ fetchImpl: rejecting }).service.activate('SP-NOPE-0000'), (e) => e.code === 'invalid_license_key' && /no válida/.test(e.message));

  const offline = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(makeService({ fetchImpl: offline }).service.activate('SP-ABCD-1234'), (err) => err.code === 'NETWORK');
  await assert.rejects(makeService().service.activate('bad key!'), (err) => err.code === 'BAD_KEY');
});

test('Service: revocation → 72h grace → blocks only new orders; un-revoke restores', async () => {
  let revoked = true;
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ revoked, status: revoked ? 'revoked' : 'active' }) });
  const { service, advance } = makeService({ fetchImpl });
  service.importLicense(makeLicense());

  let status = await service.heartbeat();
  assert.equal(status.status, 'grace');
  assert.equal(status.allowed, true);

  advance(GRACE_MS + 1000);
  status = await service.heartbeat();
  assert.equal(status.status, 'blocked');
  assert.equal(status.blocksNewOrders, true);

  revoked = false;
  status = await service.heartbeat();
  assert.equal(status.status, 'valid');
});

test('Service: perpetual license keeps working with no internet', async () => {
  const offline = async () => {
    throw new TypeError('fetch failed');
  };
  const { service, advance } = makeService({ fetchImpl: offline });
  service.importLicense(makeLicense());
  advance(365 * 24 * 60 * 60 * 1000);
  assert.equal((await service.heartbeat()).status, 'valid');
});

test('Service: expired license enters grace from its expiry date', () => {
  const { service, advance } = makeService();
  service.importLicense(makeLicense({ expiresAt: new Date(Date.now() + 1000).toISOString() }));
  assert.equal(service.getStatus().status, 'valid');
  advance(60 * 1000); // supera la caché de 30 s
  const status = service.getStatus();
  assert.equal(status.status, 'grace');
  assert.equal(status.reason, 'EXPIRED');
});

function runGate(statusObj, { method = 'GET', url = '/api/menu', accept = 'application/json' } = {}) {
  const gate = createLicenseGate({ getStatus: () => statusObj });
  const result = { nextCalled: false };
  const req = { method, path: url, headers: { accept } };
  const res = {
    status(code) {
      result.code = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    redirect(code, to) {
      result.code = code;
      result.redirect = to;
    }
  };
  gate(req, res, () => (result.nextCalled = true));
  return result;
}

test('Gate: unlicensed blocks API, redirects pages, allows activation and webhook', () => {
  const locked = { status: 'unlicensed', allowed: false, message: 'sin licencia' };
  assert.equal(runGate(locked).code, 403);
  assert.equal(runGate(locked).body.code, 'LICENSE_REQUIRED');
  assert.equal(runGate(locked, { url: '/kiosk', accept: 'text/html' }).redirect, '/activate');
  assert.equal(runGate(locked, { url: '/activate', accept: 'text/html' }).nextCalled, true);
  assert.equal(runGate(locked, { url: '/assets/index.js', accept: '*/*' }).nextCalled, true);
  assert.equal(runGate(locked, { method: 'POST', url: '/api/license/activate' }).nextCalled, true);
  assert.equal(runGate(locked, { method: 'POST', url: '/api/payments/wompi/webhook' }).nextCalled, true);
});

test('Gate: blocked rejects only new orders and payments', () => {
  const blocked = { status: 'blocked', allowed: true, blocksNewOrders: true, message: 'bloqueado' };
  assert.equal(runGate(blocked, { method: 'POST', url: '/api/orders' }).body.code, 'LICENSE_BLOCKED');
  assert.equal(runGate(blocked, { method: 'POST', url: '/api/payments/wompi/qr' }).code, 403);
  assert.equal(runGate(blocked, { method: 'PUT', url: '/api/orders/12/status' }).nextCalled, true);
  assert.equal(runGate(blocked, { method: 'POST', url: '/api/cashier/shift/close' }).nextCalled, true);
  assert.equal(runGate(blocked).nextCalled, true);
});

test('Service: escrow retrieval unwraps the key with the wrap key the portal returns', async () => {
  const dataKey = crypto.randomBytes(32);
  const wrapKey = crypto.randomBytes(32);
  const sealed = require('../server/security/crypto').seal(wrapKey, dataKey);
  const wrappedKey = Buffer.from(JSON.stringify(sealed)).toString('base64');
  let seenHeader = null;
  const fetchImpl = async (url, opts) => {
    assert.match(url, /\/api\/license\/escrow\/LIC-TEST$/);
    seenHeader = JSON.parse(Buffer.from(opts.headers['X-Fingerprint'], 'base64url').toString('utf8'));
    return { ok: true, status: 200, json: async () => ({ alg: 'aes-256-gcm', wrapKey: wrapKey.toString('base64'), wrappedKey, storedAt: null }) };
  };
  const { service } = makeService({ fetchImpl });
  const recovered = await service.fetchEscrowKey('LIC-TEST');
  assert.deepEqual(recovered, dataKey);
  assert.deepEqual(seenHeader, FP);
});

test('Service: escrow retrieval without an authorised grant surfaces the portal refusal', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ error: 'escrow_not_authorized', message: 'Recuperación no autorizada.' }) });
  const { service } = makeService({ fetchImpl });
  await assert.rejects(service.fetchEscrowKey('LIC-TEST'), (e) => e.code === 'escrow_not_authorized' && e.status === 403);
});
