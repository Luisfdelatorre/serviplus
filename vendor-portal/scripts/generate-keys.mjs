/**
 * Genera las claves del servidor y las escribe en .env.local (si no existen).
 *   - Ed25519 para firmar licencias y manifiestos.
 *   - ESCROW_MASTER_KEY para cifrar en reposo las claves de envoltura.
 *   - SESSION_SECRET para las sesiones del panel.
 * En producción, cargar estos valores como secretos del host (no desde archivo en el repo).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

const file = path.join(ROOT, '.env.local');
const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const has = (name) => new RegExp(`^${name}=`, 'm').test(existing);

const lines = [];
if (!has('LICENSE_SIGNING_PRIVATE_KEY')) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  lines.push(`LICENSE_SIGNING_PRIVATE_KEY=${privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')}`);
  lines.push(`LICENSE_SIGNING_PUBLIC_KEY=${publicKey.export({ format: 'der', type: 'spki' }).toString('base64')}`);
}
if (!has('ESCROW_MASTER_KEY')) lines.push(`ESCROW_MASTER_KEY=${crypto.randomBytes(32).toString('base64')}`);
if (!has('SESSION_SECRET')) lines.push(`SESSION_SECRET=${crypto.randomBytes(48).toString('base64')}`);

if (!lines.length) {
  console.log('.env.local ya tiene todas las claves; no se cambió nada.');
} else {
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, `${prefix}${lines.join('\n')}\n`, { mode: 0o600 });
  console.log(`Claves escritas en ${file}: ${lines.map((l) => l.split('=')[0]).join(', ')}`);
}
