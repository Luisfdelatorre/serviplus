import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, handler, HttpError, json, readJson, str } from '@/lib/http';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * PATCH { action: "release", reason }   → libera el puesto (necesario antes de activar en un PC nuevo)
 * PATCH { action: "revoke", reason }    → revoca este equipo (no podrá reactivarse con la misma licencia)
 * PATCH { action: "clear_flag" }        → quita la marca de fingerprint duplicado tras revisarla
 */
export const PATCH = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const body = await readJson(request);
  const ip = clientIp(request);
  const seat = await prisma.seat.findUnique({ where: { id } });
  if (!seat) throw new HttpError(404, 'not_found', 'Puesto no encontrado');
  const now = new Date();

  let data;
  if (body.action === 'release') {
    if (seat.status !== 'ACTIVE') throw new HttpError(409, 'not_active', 'Solo se puede liberar un puesto activo');
    data = { status: 'RELEASED', releasedAt: now, statusReason: str(body.reason, { max: 500, field: 'Motivo' }) };
  } else if (body.action === 'revoke') {
    if (seat.status === 'REVOKED') throw new HttpError(409, 'already_revoked', 'El puesto ya está revocado');
    data = { status: 'REVOKED', revokedAt: now,
      statusReason: str(body.reason, { required: true, max: 500, field: 'Motivo' }) };
  } else if (body.action === 'clear_flag') {
    data = { duplicateFlag: false };
  } else {
    throw new HttpError(400, 'validation', 'Acción desconocida');
  }

  const updated = await prisma.seat.update({ where: { id }, data });
  await audit({ operator, action: `seat.${body.action}`, entity: 'license', entityId: seat.licenseId,
    details: { seatId: id, reason: data.statusReason }, ip });
  return json({ seat: { id: updated.id, status: updated.status, duplicateFlag: updated.duplicateFlag } });
});
