/**
 * Restauración de un respaldo en un equipo nuevo (o tras reinstalar).
 *
 * 1. Pide al servidor la llave del equipo original (custodia), solo si la licencia está liberada.
 * 2. Re-cifra el respaldo con la llave de ESTE equipo en `serviplus.db.restore-pending`.
 * 3. Al próximo arranque el driver cambia ese archivo por la base activa (Windows no permite
 *    reemplazar una base abierta), y la base anterior queda como `.before-restore`.
 */
const fs = require('fs');
const { rekeyFile } = require('../db/encryptedSqlite');
const vault = require('./vault');

const PENDING_SUFFIX = '.restore-pending';

function pendingPathFor(dbPath) {
  return dbPath + PENDING_SUFFIX;
}

async function restoreFromBackup({ backups, backupFile, dbPath, licenseId, fetchEscrowKey }) {
  if (!vault.isEnabled()) {
    const err = new Error('La restauración requiere el cifrado de datos activo.');
    err.code = 'VAULT_OFF';
    throw err;
  }
  const source = backups.resolveBackup(backupFile);
  const oldKey = await fetchEscrowKey(licenseId);
  rekeyFile(source, oldKey, pendingPathFor(dbPath), vault.getDataKey());
  return { pending: pendingPathFor(dbPath), restartRequired: true };
}

/** Llamado por el driver antes de abrir la base: aplica una restauración pendiente, si hay. */
function applyPendingRestore(dbPath) {
  const pending = pendingPathFor(dbPath);
  if (!fs.existsSync(pending)) return false;
  for (const suffix of ['-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true });
  if (fs.existsSync(dbPath)) fs.renameSync(dbPath, dbPath + '.before-restore');
  fs.renameSync(pending, dbPath);
  console.log(`[Restore] Respaldo restaurado en ${dbPath}`);
  return true;
}

module.exports = { restoreFromBackup, applyPendingRestore, pendingPathFor };
