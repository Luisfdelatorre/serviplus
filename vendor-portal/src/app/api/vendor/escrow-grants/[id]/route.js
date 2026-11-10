import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, handler, HttpError, json } from '@/lib/http';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

// Cancela una autorización de recuperación que aún no se usó.
export const DELETE = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const result = await prisma.escrowGrant.updateMany({
    where: { id, usedAt: null, cancelledAt: null }, data: { cancelledAt: new Date() }
  });
  if (result.count === 0) throw new HttpError(409, 'not_open', 'La autorización ya se usó, expiró o fue cancelada');
  const grant = await prisma.escrowGrant.findUnique({ where: { id } });
  await audit({ operator, action: 'escrow.grant_cancelled', entity: 'license', entityId: grant.licenseId,
    details: { grantId: id }, ip: clientIp(request) });
  return json({ ok: true });
});
