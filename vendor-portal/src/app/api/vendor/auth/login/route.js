import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { verifyPassword } from '@/lib/crypto';
import { clientIp, handler, HttpError, json, rateLimit, readJson, str } from '@/lib/http';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export const runtime = 'nodejs';

export const POST = handler(async (request) => {
  const ip = clientIp(request);
  await rateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  const body = await readJson(request);
  const email = str(body.email, { required: true, field: 'email', max: 200 }).toLowerCase();
  const password = String(body.password || '');

  const op = await prisma.operator.findUnique({ where: { email } });
  if (!op || !op.active || !verifyPassword(password, op.passwordHash)) {
    throw new HttpError(401, 'invalid_credentials', 'Email o contraseña incorrectos');
  }
  await prisma.operator.update({ where: { id: op.id }, data: { lastLoginAt: new Date() } });
  await audit({ operator: op, action: 'operator.login', entity: 'operator', entityId: op.id, ip });

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(op.id), sessionCookieOptions());
  return json({ ok: true, operator: { id: op.id, email: op.email, name: op.name } });
});
