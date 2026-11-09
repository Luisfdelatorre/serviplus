/**
 * Simula una instalación de ServiPlus contra el servidor de licencias.
 *
 *   npm run simulate -- activate <LICENSE_KEY> [--machine A]
 *   npm run simulate -- heartbeat <LICENSE_ID> [--machine A]
 *   npm run simulate -- escrow <LICENSE_ID> [--machine A]     (sube una clave de datos de prueba)
 *   npm run simulate -- restore <LICENSE_ID> [--machine B]    (pide la clave custodiada)
 *   npm run simulate -- update [stable|beta]
 *
 * --machine elige un fingerprint de prueba determinista (A, B, …). "A~" cambia 1 componente (deriva).
 * Verifica la firma del .lic y del manifiesto con la clave pública del servidor.
 * Variable: PORTAL_URL (por defecto http://localhost:3100).
 */
import crypto from 'node:crypto';

const BASE = process.env.PORTAL_URL || 'http://localhost:3100';
const [cmd, arg, ...rest] = process.argv.slice(2);
const machineIdx = rest.indexOf('--machine');
const machine = machineIdx >= 0 && rest[machineIdx + 1] ? rest[machineIdx + 1] : 'A';

function h(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function fingerprintFor(name) {
  const base = name.replace('~', '');
  const fp = { boardUuid: h(`board-${base}`), machineGuid: h(`guid-${base}`), diskSerial: h(`disk-${base}`), cpuId: h(`cpu-${base}`) };
  if (name.endsWith('~')) fp.diskSerial = h(`disk-${base}-replaced`);
  return fp;
}

function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
}

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function verify(payload, signature) {
  const { data } = await call('GET', '/api/license/public-key');
  const key = crypto.createPublicKey({ key: Buffer.from(data.spkiBase64, 'base64'), format: 'der', type: 'spki' });
  return crypto.verify(null, Buffer.from(canonicalJson(payload)), key, Buffer.from(signature, 'base64'));
}

const fp = fingerprintFor(machine);
let out;
switch (cmd) {
  case 'activate': {
    out = await call('POST', '/api/license/activate', { licenseKey: arg, fingerprint: fp, appVersion: '1.0.0' });
    if (out.data.lic) {
      out.signatureValid = await verify(out.data.lic.payload, out.data.lic.signature);
      out.data.escrow.wrapKey = '[oculta]';
    }
    break;
  }
  case 'heartbeat':
    out = await call('POST', '/api/license/heartbeat', { licenseId: arg, fingerprint: fp, appVersion: '1.0.1' });
    break;
  case 'escrow': {
    // Clave de datos de prueba envuelta de forma opaca (el servidor nunca la ve en claro).
    out = await call('POST', '/api/license/escrow', {
      licenseId: arg, fingerprint: fp, wrappedKey: crypto.randomBytes(60).toString('base64')
    });
    break;
  }
  case 'restore': {
    const header = Buffer.from(JSON.stringify(fp)).toString('base64url');
    out = await call('GET', `/api/license/escrow/${arg}`, null, { 'x-fingerprint': header });
    if (out.data.wrappedKey) out.data = { ...out.data, wrapKey: '[recibida]', wrappedKey: '[recibida]' };
    break;
  }
  case 'update': {
    out = await call('GET', `/api/updates/${arg || 'stable'}/latest`);
    if (out.data.signature) {
      const { channel, version, url, sha256 } = out.data;
      out.signatureValid = await verify({ channel, version, url, sha256 }, out.data.signature);
    }
    break;
  }
  default:
    console.log('Comandos: activate <KEY> | heartbeat <ID> | escrow <ID> | restore <ID> | update [canal]  [--machine A]');
    process.exit(1);
}
console.log(JSON.stringify(out, null, 2));
