const fs = require('fs');
const path = require('path');

/**
 * Escribe un objeto JSON a disco de forma atómica usando archivo temporal + rename.
 * Previene corrupción de estado ante cortes súbitos de energía en terminales POS.
 */
function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  const payload = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Fallback en caso de bloqueo momentáneo de antivirus/Windows en renameSync
    try {
      fs.writeFileSync(filePath, payload, 'utf8');
    } finally {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {}
      }
    }
  }
}

/**
 * Lee un archivo JSON de forma segura retornando fallback si no existe o está corrupto.
 */
function readJsonSafe(filePath, fallbackValue) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`[atomicFile] Error leyendo ${path.basename(filePath)}:`, err.message);
  }
  return fallbackValue;
}

module.exports = {
  writeJsonAtomic,
  readJsonSafe
};
