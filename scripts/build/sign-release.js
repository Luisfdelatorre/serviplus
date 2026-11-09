#!/usr/bin/env node
/**
 * Firma un release para la actualización automática.
 *
 *   SP_UPDATE_SIGNING_KEY="$(cat sp-2026-1.private.pem)" \
 *     node scripts/build/sign-release.js --installer build/dist/Serviplus-Setup-1.0.0.exe --channel stable
 *
 * Produce `<installer>.manifest.json`: un documento firmado Ed25519 con la versión, el
 * nombre del archivo y su SHA-256. El servidor de actualizaciones sirve este manifiesto en
 * `GET /api/updates/:channel/latest`; el equipo verifica la firma con la clave pública
 * embebida (la misma que valida licencias) antes de aplicar nada. Clave privada: solo en CI.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { signDocument } = require('../../server/license/signing');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const installer = arg('installer');
const channel = arg('channel', 'stable');
const kid = arg('kid', 'sp-2026-1');
if (!installer) {
  console.error('Falta --installer <ruta>');
  process.exit(1);
}

const privateKeyPem = process.env.SP_UPDATE_SIGNING_KEY;
if (!privateKeyPem) {
  console.error('Falta la variable SP_UPDATE_SIGNING_KEY (clave privada PEM).');
  process.exit(1);
}

const bytes = fs.readFileSync(installer);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const version = (() => {
  const m = path.basename(installer).match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : require('../../package.json').version;
})();

const payload = {
  product: 'serviplus',
  channel,
  version,
  file: path.basename(installer),
  sha256,
  size: bytes.length,
  releasedAt: new Date().toISOString()
};

const doc = signDocument(payload, privateKeyPem, kid);
const out = `${installer}.manifest.json`;
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`✓ Manifiesto firmado: ${path.basename(out)} (v${version}, canal ${channel}, sha256 ${sha256.slice(0, 12)}…)`);
