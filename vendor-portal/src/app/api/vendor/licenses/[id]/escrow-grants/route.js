import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { verifyPassword } from '@/lib/crypto';
import { clientIp, handler, HttpError, json, rateLimit, readJson, str } from '@/lib/http';
import { ESCROW_GRANT_TTL_MS } from '@/lib/licensing';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Autoriza UNA recuperación de la clave custodiada durante las próximas 24 h.
 * Requiere motivo y volver a ingresar la contraseña del operador.
 */
export const POST = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const ip = clientIp(request);
  await rateLimit(`grant:${operator.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  const body = await readJson(request);
  const reason = str(body.reason, { required: true, field: 'Motivo', max: 500 });

  const op = await prisma.operator.findUnique({ where: { id: operator.id } });
  if (!verifyPassword(String(body.password || ''), op.passwordHash)) {
    await audit({ operator, action: 'escrow.grant_denied_password', entity: 'license', entityId: id, ip });
    throw new HttpError(403, 'invalid_password', 'Contraseña incorrecta');
  }

  const license = await prisma.license.findUnique({ where: { id }, include: { escrow: true } });
  if (!license) throw new HttpError(404, 'not_found', 'Licencia no encontrada');
  if (!license.escrow?.wrappedKey) throw new HttpError(409, 'escrow_empty', 'Esta licencia no tiene clave custodiada');

  const now = new Date();
  const grant = await prisma.$transaction(async (tx) => {
    // Solo una autorización abierta a la vez.
    await tx.escrowGrant.updateMany({
      where: { licenseId: id, usedAt: null, cancelledAt: null, expiresAt: { gt: now } },
      data: { cancelledAt: now }
    });
    const created = await tx.escrowGrant.create({
      data: { licenseId: id, operatorId: operator.id, reason, expiresAt: new Date(now.getTime() + ESCROW_GRANT_TTL_MS) }
    });
    await audit({ operator, action: 'escrow.grant_created', entity: 'license', entityId: id,
      details: { grantId: created.id, reason, expiresAt: created.expiresAt }, ip }, tx);
    return created;
  });
  return json({ grant: { id: grant.id, expiresAt: grant.expiresAt } }, 201);
});
