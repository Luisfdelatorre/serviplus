const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { sqlInt, sqlNum, sqlStr, sqlBool, sqlEnum } = require('../server/lib/sql');
const configStore = require('../server/config');
const {
  signSessionToken,
  verifyToken,
  attachUser,
  requireRole
} = require('../server/middleware/auth');
const {
  validateOrderPayload,
  validateOrderStatusPayload,
  validateKdsStatusPayload,
  validateShiftOpenPayload
} = require('../server/middleware/validate');
const { writeJsonAtomic, readJsonSafe } = require('../server/lib/atomicFile');
const auditService = require('../server/auditService');

test('Phase 0: SQL sanitization helpers prevent SQL injection', () => {
  assert.equal(sqlInt('42; DROP TABLE Orders'), 42);
  assert.equal(sqlInt('invalid', { fallback: 1 }), 1);
  assert.throws(() => sqlInt('invalid'));
  assert.equal(sqlNum('15.75'), 15.75);
  assert.equal(sqlBool(true), 'True');
  assert.equal(sqlBool(false), 'False');

  const malicious = "1234' OR '1'='1";
  const escaped = sqlStr(malicious);
  assert.equal(escaped, "'1234'' OR ''1''=''1'");

  assert.equal(sqlEnum('2', ['1', '2', '3'], '1'), '2');
  assert.equal(sqlEnum("2'; DROP TABLE--", ['1', '2', '3'], '1'), '1');
});

test('Phase 0: Config redaction masks private secrets and exposes safe public config', () => {
  const pub = configStore.getPublicConfig();
  assert.ok(pub.restaurant);
  assert.ok(pub.kiosk);
  assert.ok(pub.wompi);
  assert.equal(pub.wompi.privateKey, undefined, 'Public config must not include wompi privateKey');
  assert.equal(pub.wompi.integritySecret, undefined, 'Public config must not include wompi integritySecret');
  assert.equal(pub.whatsapp, undefined, 'Public config must not include whatsapp token');

  const redacted = configStore.getRedactedConfig();
  if (redacted.wompi?.sandbox?.privateKey) {
    assert.ok(
      redacted.wompi.sandbox.privateKey.includes('••••'),
      'Redacted config must mask wompi sandbox privateKey'
    );
  }
});

test('Phase 2: JWT signing, verification, and RBAC middleware work as expected', () => {
  const token = signSessionToken({
    id: 7,
    name: 'Admin Tester',
    role: 'admin',
    securityLevel: 1
  });

  const decoded = verifyToken(token);
  assert.ok(decoded);
  assert.equal(decoded.employeeId, 7);
  assert.equal(decoded.role, 'admin');

  // Test attachUser + requireRole with valid token
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;
  attachUser(req, {}, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'admin');

  let rolePassed = false;
  const checkAdmin = requireRole('admin');
  checkAdmin(req, {}, () => {
    rolePassed = true;
  });
  assert.equal(rolePassed, true);

  // Test invalid role rejection when token has non-matching role
  const cashierToken = signSessionToken({
    id: 9,
    name: 'Cashier User',
    role: 'cashier',
    securityLevel: 5,
    isAdmin: false
  });
  const cashierReq = { headers: { authorization: `Bearer ${cashierToken}` } };
  attachUser(cashierReq, {}, () => {});

  let statusSet = null;
  let bodySent = null;
  const mockRes = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(payload) {
      bodySent = payload;
      return this;
    }
  };
  checkAdmin(cashierReq, mockRes, () => {});
  assert.equal(statusSet, 403);
  assert.equal(bodySent.success, false);
});

test('Phase 2: Request payload validators reject malformed POS payloads', () => {
  const makeRes = () => {
    const res = {
      statusCode: 200,
      payload: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(p) {
        this.payload = p;
        return this;
      }
    };
    return res;
  };

  // Empty items order must fail with 400
  const res1 = makeRes();
  validateOrderPayload({ body: { items: [] } }, res1, () => {});
  assert.equal(res1.statusCode, 400);

  // Valid order payload passes
  let orderValid = false;
  validateOrderPayload(
    { body: { orderType: 1, items: [{ id: 10, quantity: 2, price: 15 }] } },
    makeRes(),
    () => {
      orderValid = true;
    }
  );
  assert.equal(orderValid, true);

  // Invalid order status must fail with 400
  const res2 = makeRes();
  validateOrderStatusPayload({ body: { status: '99' } }, res2, () => {});
  assert.equal(res2.statusCode, 400);

  // Invalid KDS status must fail with 400
  const res3 = makeRes();
  validateKdsStatusPayload({ body: { kdsStatus: 'HACKED' } }, res3, () => {});
  assert.equal(res3.statusCode, 400);

  // Negative shift initial cash must fail with 400
  const res4 = makeRes();
  validateShiftOpenPayload({ body: { initialCash: -500 } }, res4, () => {});
  assert.equal(res4.statusCode, 400);
});

test('Phase 5: Atomic file persistence and AuditService record events reliably', () => {
  const tmpFile = path.join(__dirname, 'tmp_atomic_test.json');
  try {
    writeJsonAtomic(tmpFile, { ok: true, count: 3 });
    const data = readJsonSafe(tmpFile, null);
    assert.deepEqual(data, { ok: true, count: 3 });
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }

  const entry = auditService.record({
    action: 'TEST_AUDIT_EVENT',
    actor: 'unit_test',
    target: 'ORD-100',
    details: { verified: true }
  });
  assert.ok(entry.id.startsWith('AUD-'));
  const logs = auditService.getLogs(5);
  assert.ok(logs.some((l) => l.id === entry.id));
});

test('Phase 4: Zero inline style={{}} across all React JSX components', () => {
  const srcDir = path.join(__dirname, '../client/src');
  const walk = (dir) => {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files = files.concat(walk(full));
      else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx')) files.push(full);
    }
    return files;
  };

  const jsxFiles = walk(srcDir);
  assert.ok(jsxFiles.length > 20, 'Should scan all JSX files in client/src');

  const violations = [];
  for (const file of jsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('style={{')) {
      violations.push(path.relative(srcDir, file));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found prohibited inline style={{}} in: ${violations.join(', ')}`
  );
});
