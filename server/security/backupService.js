/**
 * Respaldos diarios de la base SQLite (cifrados cuando la bóveda está activa).
 *
 * Cada respaldo es una copia consistente hecha con VACUUM INTO mientras la app sigue operando.
 * Se conservan los últimos `retain` respaldos. Solo se pueden restaurar archivos que estén
 * dentro de la carpeta de respaldos (evita leer rutas arbitrarias del disco).
 */
const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 10 * 60 * 1000;

function createBackupService({ dataDir, getConnection, now = () => new Date(), retain = 14 }) {
  const backupDir = path.join(dataDir, 'backups');
  let timers = [];

  function stamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  /** Respaldos existentes, del más nuevo al más antiguo. */
  function list() {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir)
      .filter((name) => /^serviplus-\d{8}-\d{6}\.db$/.test(name))
      .sort()
      .reverse();
  }

  function prune() {
    for (const name of list().slice(retain)) fs.rmSync(path.join(backupDir, name), { force: true });
  }

  /** Crea un respaldo ahora. Devuelve la ruta del archivo. */
  function runBackup() {
    const connection = getConnection();
    if (!connection || typeof connection.backupTo !== 'function') {
      throw new Error('El modo de base de datos activo no admite respaldos de Serviplus (Aldelo gestiona su propio archivo).');
    }
    fs.mkdirSync(backupDir, { recursive: true });
    const file = path.join(backupDir, `serviplus-${stamp(now())}.db`);
    connection.backupTo(file);
    prune();
    return file;
  }

  /** Valida que `file` sea un respaldo de esta carpeta y devuelve su ruta absoluta. */
  function resolveBackup(file) {
    const resolved = path.resolve(backupDir, String(file || ''));
    const inside = resolved.startsWith(backupDir + path.sep);
    if (!inside || !resolved.endsWith('.db') || !fs.existsSync(resolved)) {
      const err = new Error('El respaldo indicado no existe en la carpeta de respaldos.');
      err.code = 'BAD_BACKUP';
      throw err;
    }
    return resolved;
  }

  function start() {
    timers = [
      setTimeout(() => safeRun(), FIRST_RUN_DELAY_MS),
      setInterval(() => safeRun(), DAY_MS)
    ];
    for (const t of timers) if (t.unref) t.unref();
  }

  function safeRun() {
    try {
      runBackup();
    } catch (err) {
      console.warn('[Backup] No se pudo crear el respaldo:', err.message);
    }
  }

  function stop() {
    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    timers = [];
  }

  return { runBackup, list, resolveBackup, start, stop, backupDir };
}

module.exports = { createBackupService };
