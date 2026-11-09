/**
 * Crea (o actualiza la contraseña de) un operador del panel.
 * Uso: SEED_OPERATOR_PASSWORD='...' npm run db:seed
 * Variables: SEED_OPERATOR_EMAIL, SEED_OPERATOR_NAME, SEED_OPERATOR_PASSWORD (mín. 12 caracteres).
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './env.mjs';

loadEnv();
const email = String(process.env.SEED_OPERATOR_EMAIL || '').trim().toLowerCase();
const name = String(process.env.SEED_OPERATOR_NAME || 'Administrador').trim();
const password = String(process.env.SEED_OPERATOR_PASSWORD || '');

if (!email || password.length < 12) {
  console.error('Define SEED_OPERATOR_EMAIL y SEED_OPERATOR_PASSWORD (mínimo 12 caracteres).');
  process.exit(1);
}

// Mismo formato que src/lib/crypto.js → hashPassword
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const passwordHash = ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');

const prisma = new PrismaClient();
const op = await prisma.operator.upsert({
  where: { email },
  update: { passwordHash, name, active: true },
  create: { email, name, passwordHash }
});
console.log(`Operador listo: ${op.email}`);
await prisma.$disconnect();
