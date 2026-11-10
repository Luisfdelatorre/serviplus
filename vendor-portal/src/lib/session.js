/**
 * Sesión de operadores del proveedor (independiente del /api/admin de la app del restaurante).
 * Cookie httpOnly con token `base64url(payload).hmac` firmado con SESSION_SECRET.
 */
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { HttpError } from './http';

export const SESSION_COOKIE = 'svp_vendor_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 h

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET no configurado (npm run keys:generate)');
  return s;
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function createSessionToken(operatorId) {
  const payload = Buffer.from(JSON.stringify({ sub: operatorId, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000
  };
}

/** Operador de la sesión actual o null. Usable en server components y route handlers. */
export async function getOperator() {
  const store = await cookies();
  const data = parseSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!data) return null;
  const op = await prisma.operator.findUnique({ where: { id: data.sub } });
  if (!op || !op.active) return null;
  return { id: op.id, email: op.email, name: op.name };
}

export async function requireOperator(request) {
  // Defensa CSRF básica además de SameSite=strict: las mutaciones deben venir del mismo origen.
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      throw new HttpError(403, 'bad_origin', 'Origen no permitido');
    }
  }
  const op = await getOperator();
  if (!op) throw new HttpError(401, 'unauthorized', 'Sesión requerida');
  return op;
}
