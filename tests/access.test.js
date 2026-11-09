const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'x'.repeat(48);
const { requireAdminSession, signSessionToken, attachUser } = require('../server/middleware/auth');
const { loadOrCreateSetupToken, setupAccessAllowed, isLoopback } = require('../server/security/setupAccess');
const { createUpdateRoutes } = require('../server/routes/updateRoutes');

function fakeRes() {
  return {
    code: 200,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }
  };
}

test('Admin session: anonymous and non-admin requests are refused, admins pass', () => {
  let passed = 0;
  const next = () => passed++;
  const anon = fakeRes();
  requireAdminSession({}, anon, next);
  assert.equal(anon.code, 401);
  const cashier = fakeRes();
  requireAdminSession({ user: { role: 'cashier' } }, cashier, next);
  assert.equal(cashier.code, 403);
  requireAdminSession({ user: { role: 'admin' } }, fakeRes(), next);
  assert.equal(passed, 1);
});

test('Setup token: created once, loopback is trusted, LAN needs the matching token', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-access-'));
  const token = loadOrCreateSetupToken(dir);
  assert.equal(loadOrCreateSetupToken(dir), token, 'el token no cambia entre arranques');

  const lan = { socket: { remoteAddress: '192.168.1.50' }, headers: {} };
  assert.equal(isLoopback({ socket: { remoteAddress: '127.0.0.1' } }), true);
  assert.equal(isLoopback(lan), false);
  assert.equal(setupAccessAllowed({ socket: { remoteAddress: '127.0.0.1' }, headers: {} }, dir), true);
  assert.equal(setupAccessAllowed(lan, dir), false, 'sin token, la LAN no configura');
  lan.headers['x-setup-token'] = 'wrong';
  assert.equal(setupAccessAllowed(lan, dir), false);
  lan.headers['x-setup-token'] = token;
  assert.equal(setupAccessAllowed(lan, dir), true);
});

test('Over HTTP: an update action without a login is refused; with an admin login it is accepted', async () => {
  const fakeUpdates = {
    getStatus: () => ({ currentVersion: '1.0.0' }),
    check: async () => ({}),
    apply: async () => ({ started: true })
  };
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.use('/api/updates', createUpdateRoutes(fakeUpdates));
  const server = http.createServer(app).listen(0);
  const port = server.address().port;
  const call = (headers) => new Promise((resolve, reject) => {
    const req = http.request({ port, path: '/api/updates/apply', method: 'POST', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
  try {
    assert.equal(await call({}), 401, 'sin sesión no se aplica nada');
    const adminToken = signSessionToken({ id: 1, name: 'Gerente', role: 'admin' }, '1h');
    assert.equal(await call({ Authorization: `Bearer ${adminToken}` }), 202);
  } finally {
    server.close();
  }
});
