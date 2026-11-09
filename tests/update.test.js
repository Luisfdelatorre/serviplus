const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { signDocument, keyIdFor } = require('../server/license/signing');
const { compareVersions, verifyManifest, createUpdateService, UpdateError } = require('../server/update/updateService');
const { runUpdate } = require('../server/update/updater');

// Clave de prueba registrada como clave pública de desarrollo (igual que en license.test.js).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-update-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const PRIV = privateKey.export({ type: 'pkcs8', format: 'pem' });
fs.writeFileSync(path.join(tmp, 'pub.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
process.env.SP_LICENSE_PUBLIC_KEY_FILE = path.join(tmp, 'pub.pem');

const BYTES = Buffer.from('fake-installer-bytes');
const SHA = crypto.createHash('sha256').update(BYTES).digest('hex');
const KEY_ID = keyIdFor(fs.readFileSync(path.join(tmp, 'pub.pem'), 'utf8'));
const DOWNLOAD_URL = 'https://releases.test/Serviplus-Setup-1.1.0.exe';

/** Manifiesto tal como lo devuelve el portal: objeto plano firmado sobre { channel, sha256, url, version }. */
function manifest(overrides = {}) {
  const payload = { channel: 'stable', sha256: SHA, url: DOWNLOAD_URL, version: '1.1.0', ...overrides };
  const signed = signDocument(payload, PRIV, 'x');
  return { ...payload, publishedAt: '2026-11-09T00:00:00.000Z', notes: null, keyId: KEY_ID, signature: signed.signature };
}

function jsonResponse(body, status = 200) {
  return { ok: status < 300, status, json: async () => body, arrayBuffer: async () => BYTES };
}

function makeService({ fetchImpl, current = '1.0.0', packaged = false, spawned = [] } = {}) {
  const dataDir = fs.mkdtempSync(path.join(tmp, 'data-'));
  return {
    dataDir,
    spawned,
    service: createUpdateService({
      appRoot: tmp,
      dataDir,
      currentVersion: current,
      isPackaged: packaged,
      getConfig: () => ({ license: { serverUrl: 'http://updates.test' } }),
      getChannel: () => 'stable',
      fetchImpl,
      spawnUpdater: (args) => spawned.push(args)
    })
  };
}

test('Updates: versions compare numerically (1.2.10 > 1.2.9)', () => {
  assert.equal(compareVersions('1.2.10', '1.2.9') > 0, true);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.9.9', '1.0.0') < 0, true);
});

test('Updates: a valid newer manifest is accepted', () => {
  const p = verifyManifest(manifest(), { currentVersion: '1.0.0', channel: 'stable' });
  assert.equal(p.version, '1.1.0');
});

test('Updates: forged, wrong-channel, not-newer and incomplete manifests are rejected', () => {
  const ok = { currentVersion: '1.0.0', channel: 'stable' };
  const forged = { ...manifest(), version: '9.9.9' };
  assert.throws(() => verifyManifest(forged, ok), (e) => e.code === 'BAD_SIGNATURE');
  assert.throws(() => verifyManifest(manifest({ channel: 'beta' }), ok), (e) => e.code === 'WRONG_CHANNEL');
  assert.throws(() => verifyManifest(manifest({ version: '1.0.0' }), ok), (e) => e.code === 'NOT_NEWER');
  const noHash = manifest();
  delete noHash.sha256;
  assert.throws(() => verifyManifest(noHash, ok), (e) => e.code === 'BAD_SIGNATURE');
});

test('Updates: a manifest with no published release is treated as "nothing available"', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({ error: 'no_release', message: 'No hay versiones publicadas en este canal' }) });
  const { service } = makeService({ fetchImpl });
  const status = await service.check();
  assert.equal(status.available, null);
  assert.equal(status.lastError, null);
});

test('Updates: check stores an available update without downloading it', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /\/api\/updates\/stable\/latest$/);
    return jsonResponse(manifest());
  };
  const { service } = makeService({ fetchImpl });
  const status = await service.check();
  assert.equal(status.available.version, '1.1.0');
  assert.equal(status.lastError, null);
});

test('Updates: check with nothing newer clears availability without an error', async () => {
  const fetchImpl = async () => jsonResponse(manifest({ version: '1.0.0' }));
  const { service } = makeService({ fetchImpl });
  const status = await service.check();
  assert.equal(status.available, null);
  assert.equal(status.lastError, null);
});

test('Updates: a network failure during check is reported, not thrown', async () => {
  const fetchImpl = async () => {
    throw new TypeError('fetch failed');
  };
  const { service } = makeService({ fetchImpl });
  const status = await service.check();
  assert.equal(status.lastError.code, 'NETWORK');
});

test('Updates: download is verified against the signed SHA-256; tampered bytes are discarded', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/latest')) return jsonResponse(manifest());
    return { ok: true, status: 200, arrayBuffer: async () => Buffer.from('TAMPERED-BYTES!!') };
  };
  const { service, dataDir } = makeService({ fetchImpl });
  await service.check();
  await assert.rejects(service.download(), (e) => e.code === 'INTEGRITY');
  const leftovers = fs.readdirSync(path.join(dataDir, 'updates', '1.1.0'));
  assert.deepEqual(leftovers, []);
});

test('Updates: a good download is kept and returned', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/latest')) return jsonResponse(manifest());
    return { ok: true, status: 200, arrayBuffer: async () => BYTES };
  };
  const { service } = makeService({ fetchImpl });
  await service.check();
  const file = await service.download();
  assert.equal(fs.readFileSync(file).equals(BYTES), true);
});

test('Updates: applying is refused on a development (non-installed) machine', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/latest')) return jsonResponse(manifest());
    return { ok: true, status: 200, arrayBuffer: async () => BYTES };
  };
  const { service } = makeService({ fetchImpl, packaged: false });
  await service.check();
  await assert.rejects(service.apply(), (e) => e.code === 'NOT_INSTALLED');
});

test('Updates: applying on an installed machine stages the pending update and launches the updater', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/latest')) return jsonResponse(manifest());
    return { ok: true, status: 200, arrayBuffer: async () => BYTES };
  };
  const { service, dataDir, spawned } = makeService({ fetchImpl, packaged: true });
  await service.check();
  const res = await service.apply();
  assert.equal(res.version, '1.1.0');
  assert.equal(spawned.length, 1);
  const pending = JSON.parse(fs.readFileSync(path.join(dataDir, 'updates', 'pending.json'), 'utf8'));
  assert.equal(pending.previousVersion, '1.0.0');
  assert.equal(pending.version, '1.1.0');
  // Mientras hay una actualización pendiente no se lanza otra.
  await assert.rejects(service.apply(), (e) => e instanceof UpdateError && e.code === 'ALREADY_RUNNING');
});

// ---------- Orquestador del actualizador (dependencias falsas en memoria) ----------

function fakeWorld({ healthy = [true], installerCode = 0 } = {}) {
  const files = new Map(); // ruta -> contenido (string) o marca de directorio
  const json = new Map();
  const calls = [];
  const healthQueue = [...healthy];
  const world = {
    files,
    json,
    calls,
    deps: {
      runCommand: async (exe, args) => {
        calls.push(['run', path.basename(exe), args[0]]);
        if (args.includes('/VERYSILENT')) return { code: installerCode };
        return { code: 0 };
      },
      copyDir: (src, dest) => {
        calls.push(['copyDir', src, dest]);
        files.set(dest, 'dir');
        for (const [k, v] of [...files]) if (k.startsWith(src + '/')) files.set(dest + k.slice(src.length), v);
      },
      copyFile: (src, dest) => {
        calls.push(['copyFile', src, dest]);
        files.set(dest, files.get(src));
      },
      exists: (p) => files.has(p),
      readJson: (p, fb) => (json.has(p) ? JSON.parse(JSON.stringify(json.get(p))) : fb),
      writeJson: (p, data) => json.set(p, JSON.parse(JSON.stringify(data))),
      remove: (p) => {
        files.delete(p);
        json.delete(p);
      },
      healthy: async () => (healthQueue.length > 1 ? healthQueue.shift() : healthQueue[0]),
      sleep: async () => {},
      log: () => {},
      now: () => 1_000_000
    }
  };
  return world;
}

const OPTS = { appDir: '/app', dataDir: '/data', pendingPath: '/data/updates/pending.json', serviceExe: '/app/serviplus-service.exe', port: 80 };

function seedPending(world) {
  world.json.set(OPTS.pendingPath, { version: '1.1.0', previousVersion: '1.0.0', installerPath: '/data/updates/1.1.0/setup.exe' });
  world.files.set('/app/server.js', 'old-code');
  world.files.set('/data/serviplus.db', 'db-v1');
}

test('Updater: no pending update is a no-op', async () => {
  const world = fakeWorld();
  const res = await runUpdate(OPTS, world.deps);
  assert.equal(res.status, 'noop');
  assert.equal(world.calls.length, 0);
});

test('Updater: success stops the service, installs, starts, and clears the pending update', async () => {
  const world = fakeWorld({ healthy: [true] });
  seedPending(world);
  const res = await runUpdate(OPTS, world.deps);
  assert.equal(res.status, 'applied');
  assert.equal(world.json.has(OPTS.pendingPath), false);
  const order = world.calls.filter((c) => c[0] === 'run').map((c) => c[2]);
  assert.deepEqual(order, ['stop', '/VERYSILENT', 'start']);
  assert.equal(world.json.get('/data/update-state.json').lastResult.status, 'applied');
});

test('Updater: installer failure restores the backup and reports rolled_back', async () => {
  const world = fakeWorld({ healthy: [true], installerCode: 5 });
  seedPending(world);
  // El instalador escribe a medias: el cambio ocurre DESPUÉS del respaldo.
  const install = world.deps.runCommand;
  world.deps.runCommand = async (exe, args) => {
    if (args.includes('/VERYSILENT')) world.files.set('/app/server.js', 'new-code-half-written');
    return install(exe, args);
  };
  const res = await runUpdate(OPTS, world.deps);
  assert.equal(res.status, 'rolled_back');
  assert.match(res.error, /código 5/);
  assert.equal(world.files.get('/app/server.js'), 'old-code');
  assert.equal(world.json.get('/data/update-state.json').lastResult.status, 'rolled_back');
});

test('Updater: a new version that never answers is rolled back and the old one restarted', async () => {
  // healthy: falla siempre tras la instalación (la versión nueva no responde).
  const world = fakeWorld({ healthy: [false] });
  seedPending(world);
  world.deps.now = (() => {
    let t = 0;
    return () => (t += 30000); // cada consulta avanza 30 s: el plazo de 60 s se agota enseguida
  })();
  const res = await runUpdate(OPTS, world.deps);
  assert.equal(res.status, 'rolled_back');
  assert.match(res.error, /60 segundos/);
  const order = world.calls.filter((c) => c[0] === 'run').map((c) => c[2]);
  assert.equal(order[order.length - 1], 'start');
  assert.equal(world.files.get('/app/server.js'), 'old-code');
  assert.equal(world.json.has(OPTS.pendingPath), false);
});

test('Updater: the SQLite database is restored on rollback (migrations may have changed it)', async () => {
  const world = fakeWorld({ healthy: [false] });
  seedPending(world);
  world.deps.now = (() => {
    let t = 0;
    return () => (t += 30000);
  })();
  // La versión nueva migra la base durante el arranque, es decir, después del respaldo.
  // Solo el primer arranque de la versión nueva migra; el de restauración no.
  const install = world.deps.runCommand;
  let starts = 0;
  world.deps.runCommand = async (exe, args) => {
    const res = await install(exe, args);
    if (args.includes('start') && ++starts === 1) world.files.set('/data/serviplus.db', 'db-after-migration');
    return res;
  };
  await runUpdate(OPTS, world.deps);
  assert.equal(world.files.get('/data/serviplus.db'), 'db-v1');
});
