const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const sealCrypto = require('../server/security/crypto');
const keystore = require('../server/security/keystore');
const secrets = require('../server/security/secretsStore');
const vault = require('../server/security/vault');
const encrypted = require('../server/db/encryptedSqlite');
const { createBackupService } = require('../server/security/backupService');
const { restoreFromBackup, applyPendingRestore } = require('../server/security/restore');
const { buildFingerprint } = require('../server/license/fingerprint');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-security-'));
const newDir = (name) => fs.mkdtempSync(path.join(tmp, `${name}-`));
const RAW = { board: 'BOARD-1', machine: 'GUID-1', disk: 'DISK-1', cpu: 'CPU-1' };
const FP = buildFingerprint(RAW);

// ---------- crypto ----------

test('Crypto: seal/open roundtrip, tamper and wrong key are detected', () => {
  const key = sealCrypto.randomKey();
  const sealed = sealCrypto.seal(key, Buffer.from('hola'));
  assert.equal(sealCrypto.open(key, sealed).toString(), 'hola');

  const tampered = { ...sealed, data: Buffer.from('xxxx').toString('base64') };
  assert.throws(() => sealCrypto.open(key, tampered));
  assert.throws(() => sealCrypto.open(sealCrypto.randomKey(), sealed));
});

// ---------- keystore (3 de 4 componentes) ----------

test('Keystore: creates a key bound to the machine and unlocks it again', () => {
  const dir = newDir('ks');
  const key = keystore.createKeystore(dir, FP);
  assert.equal(key.length, 32);
  assert.deepEqual(keystore.unlockKeystore(dir, FP), key);
});

test('Keystore: a disk swap (3 of 4 still match) keeps the data readable', () => {
  const dir = newDir('ks');
  const key = keystore.createKeystore(dir, FP);
  const swapped = buildFingerprint({ ...RAW, disk: 'NEW-DISK' });
  assert.deepEqual(keystore.unlockKeystore(dir, swapped), key);
});

test('Keystore: a copy to another PC (2+ components differ) cannot be opened', () => {
  const dir = newDir('ks');
  keystore.createKeystore(dir, FP);
  const other = buildFingerprint({ board: 'X', machine: 'Y', disk: 'DISK-1', cpu: 'Z' });
  assert.throws(() => keystore.unlockKeystore(dir, other), (e) => e.code === 'KEY_MISMATCH');
});

test('Keystore: refuses to overwrite an existing key (would lock the data forever)', () => {
  const dir = newDir('ks');
  keystore.createKeystore(dir, FP);
  assert.throws(() => keystore.createKeystore(dir, FP), (e) => e.code === 'EXISTS');
});

test('Keystore: needs at least 3 identifiable hardware components', () => {
  const dir = newDir('ks');
  const weak = buildFingerprint({ board: 'B', machine: null, disk: null, cpu: 'C' });
  assert.throws(() => keystore.createKeystore(dir, weak), (e) => e.code === 'HARDWARE_UNKNOWN');
});

test('Keystore: the file never contains the hardware values in clear', () => {
  const dir = newDir('ks');
  keystore.createKeystore(dir, FP);
  const text = fs.readFileSync(path.join(dir, 'keystore.json'), 'utf8');
  for (const value of Object.values(RAW)) assert.equal(text.includes(value), false);
});

// ---------- secretos ----------

test('Secrets: stored encrypted and merged; plaintext never appears on disk', () => {
  const dir = newDir('sec');
  const key = sealCrypto.randomKey();
  secrets.mergeSecrets(dir, key, { WOMPI_PRIVATE_KEY: 'prv_test_123' });
  secrets.mergeSecrets(dir, key, { AUTH_SECRET: 'abc' });
  assert.deepEqual(secrets.loadSecrets(dir, key), { WOMPI_PRIVATE_KEY: 'prv_test_123', AUTH_SECRET: 'abc' });
  assert.equal(fs.readFileSync(secrets.secretsPath(dir), 'utf8').includes('prv_test_123'), false);
  assert.throws(() => secrets.loadSecrets(dir, sealCrypto.randomKey()));
});

test('Secrets: a plaintext .env is migrated and deleted only after a verified copy', () => {
  const dir = newDir('sec');
  const envPath = path.join(dir, '.env');
  fs.writeFileSync(envPath, 'SMS_API_KEY=sms-123\nWA_ACCESS_TOKEN=wa-456\n');
  const key = sealCrypto.randomKey();
  assert.equal(secrets.migrateEnvFile(envPath, dir, key), true);
  assert.equal(fs.existsSync(envPath), false);
  assert.equal(secrets.loadSecrets(dir, key).WA_ACCESS_TOKEN, 'wa-456');
});

// ---------- vault ----------

test('Vault: off by default in development, on for packaged builds or SP_DATA_ENCRYPTION=1', () => {
  assert.equal(vault.isEnabledFor({ isPackaged: false, env: {} }), false);
  assert.equal(vault.isEnabledFor({ isPackaged: true, env: {} }), true);
  assert.equal(vault.isEnabledFor({ isPackaged: true, env: { SP_DATA_ENCRYPTION: '0' } }), false);
  assert.equal(vault.isEnabledFor({ isPackaged: false, env: { SP_DATA_ENCRYPTION: '1' } }), true);
});

test('Vault: init creates the key once, loads secrets into env, and reopens on the next start', () => {
  vault._resetForTests();
  const dir = newDir('vault');
  const envPath = path.join(dir, '.env');
  fs.writeFileSync(envPath, 'VAULT_TEST_SECRET=s3cret\n');
  delete process.env.VAULT_TEST_SECRET;

  const first = vault.init({ dataDir: dir, envPath, enabled: true, getFingerprint: () => FP });
  assert.equal(first.created, true);
  assert.equal(process.env.VAULT_TEST_SECRET, 's3cret');
  assert.equal(fs.existsSync(envPath), false);
  const firstKey = vault.getDataKey();

  vault._resetForTests();
  delete process.env.VAULT_TEST_SECRET;
  const second = vault.init({ dataDir: dir, envPath, enabled: true, getFingerprint: () => FP });
  assert.equal(second.created, false);
  assert.deepEqual(vault.getDataKey(), firstKey);
  assert.equal(process.env.VAULT_TEST_SECRET, 's3cret');
  vault._resetForTests();
  delete process.env.VAULT_TEST_SECRET;
});

// ---------- SQLCipher ----------

function makeLegacyDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE OrderHeaders (OrderID INTEGER PRIMARY KEY, AmountDue REAL);
    CREATE INDEX idx_amount ON OrderHeaders(AmountDue);
    CREATE TABLE Log (Id INTEGER PRIMARY KEY, Note TEXT);
    CREATE TRIGGER trg_log AFTER INSERT ON Log BEGIN SELECT 1; END;
    CREATE VIEW v_orders AS SELECT OrderID FROM OrderHeaders;
    INSERT INTO OrderHeaders VALUES (1, 10.5), (2, 20), (3, 30);
    INSERT INTO Log (Note) VALUES ('uno'), ('dos');
  `);
  db.close();
}

test('SQLCipher: an in-use plaintext database is migrated in place with all rows intact', () => {
  const dir = newDir('db');
  const file = path.join(dir, 'app.db');
  makeLegacyDb(file);
  assert.equal(encrypted.isPlaintextSqlite(file), true);

  const key = sealCrypto.randomKey();
  encrypted.encryptInPlace(file, key);
  assert.equal(encrypted.isPlaintextSqlite(file), false);

  const db = encrypted.openEncrypted(file, key);
  assert.equal(db.prepare('SELECT count(*) n FROM OrderHeaders').get().n, 3);
  assert.equal(db.prepare('SELECT count(*) n FROM Log').get().n, 2);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name = 'idx_amount'").get().n, 1);
  db.close();
});

test('SQLCipher: the encrypted file is unreadable without the key and rejects a wrong one', () => {
  const dir = newDir('db');
  const file = path.join(dir, 'app.db');
  makeLegacyDb(file);
  const key = sealCrypto.randomKey();
  encrypted.encryptInPlace(file, key);
  assert.throws(() => encrypted.openEncrypted(file, sealCrypto.randomKey()));
});

test('SQLCipher: backups are encrypted and restorable; rekeying moves data to a new key', () => {
  const dir = newDir('db');
  const file = path.join(dir, 'app.db');
  makeLegacyDb(file);
  const oldKey = sealCrypto.randomKey();
  encrypted.encryptInPlace(file, oldKey);

  const live = encrypted.openEncrypted(file, oldKey);
  const backup = path.join(dir, 'copy.db');
  encrypted.vacuumInto(live, backup);
  live.close();
  assert.equal(encrypted.isPlaintextSqlite(backup), false);

  const newKey = sealCrypto.randomKey();
  const rekeyed = path.join(dir, 'rekeyed.db');
  encrypted.rekeyFile(backup, oldKey, rekeyed, newKey);
  const db = encrypted.openEncrypted(rekeyed, newKey);
  assert.equal(db.prepare('SELECT count(*) n FROM OrderHeaders').get().n, 3);
  db.close();
  assert.throws(() => encrypted.openEncrypted(rekeyed, oldKey));
});

// ---------- respaldos y restauración ----------

test('Backups: keeps the newest N, and refuses paths outside the backup folder', () => {
  const dir = newDir('bk');
  let minute = 0;
  const svc = createBackupService({
    dataDir: dir,
    retain: 2,
    now: () => new Date(2026, 10, 9, 10, minute++, 0),
    getConnection: () => ({ backupTo: (dest) => fs.writeFileSync(dest, 'x') })
  });
  svc.runBackup();
  svc.runBackup();
  svc.runBackup();
  assert.equal(svc.list().length, 2);
  assert.throws(() => svc.resolveBackup('../../etc/passwd'), (e) => e.code === 'BAD_BACKUP');
  assert.throws(() => svc.resolveBackup(path.join(dir, 'secrets.enc')), (e) => e.code === 'BAD_BACKUP');
});

test('Backups: refused on a connection that cannot back up (Aldelo mode)', () => {
  const svc = createBackupService({ dataDir: newDir('bk'), getConnection: () => ({}) });
  assert.throws(() => svc.runBackup(), /no admite respaldos/);
});

test('Restore: rekeys a backup with the escrowed key and swaps it in on the next start', async () => {
  vault._resetForTests();
  const dir = newDir('restore');
  const dbPath = path.join(dir, 'serviplus.db');
  makeLegacyDb(dbPath);
  const oldKey = sealCrypto.randomKey();
  encrypted.encryptInPlace(dbPath, oldKey);
  const backups = createBackupService({ dataDir: dir, getConnection: () => ({ backupTo: (dest) => encrypted.vacuumInto(encrypted.openEncrypted(dbPath, oldKey), dest) }) });
  const backupFile = backups.runBackup();

  // Este equipo: vault con su propia llave nueva.
  vault.init({ dataDir: newDir('newpc'), envPath: path.join(dir, 'nope.env'), enabled: true, getFingerprint: () => FP });
  const result = await restoreFromBackup({
    backups,
    backupFile: path.basename(backupFile),
    dbPath,
    licenseId: 'LIC-1',
    fetchEscrowKey: async (licenseId) => {
      assert.equal(licenseId, 'LIC-1');
      return oldKey;
    }
  });
  assert.equal(result.restartRequired, true);
  assert.equal(applyPendingRestore(dbPath), true);

  const db = encrypted.openEncrypted(dbPath, vault.getDataKey());
  assert.equal(db.prepare('SELECT count(*) n FROM OrderHeaders').get().n, 3);
  db.close();
  assert.equal(fs.existsSync(dbPath + '.before-restore'), true);
  vault._resetForTests();
});

test('Restore: refused when the vault is off (no key to re-encrypt with)', async () => {
  vault._resetForTests();
  const dir = newDir('restore-off');
  const backups = createBackupService({ dataDir: dir, getConnection: () => ({}) });
  await assert.rejects(
    restoreFromBackup({ backups, backupFile: 'x.db', dbPath: path.join(dir, 'a.db'), licenseId: 'L', fetchEscrowKey: async () => sealCrypto.randomKey() }),
    (e) => e.code === 'VAULT_OFF'
  );
});
