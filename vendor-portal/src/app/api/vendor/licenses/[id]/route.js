import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, handler, HttpError, json, readJson, str } from '@/lib/http';
import { parseLicenseInput } from '@/lib/licenseInput';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * PATCH { features?, channel?, expiresAt?, maxSeats?, notes? }  → edita
 * PATCH { action: "revoke", reason } | { action: "reinstate" }   → cambia el estado
 */
export const PATCH = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const body = await readJson(request);
  const ip = clientIp(request);
  const current = await prisma.license.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'not_found', 'Licencia no encontrada');

  if (body.action === 'revoke') {
    const reason = str(body.reason, { required: true, field: 'Motivo', max: 500 });
    const license = await prisma.license.update({
      where: { id }, data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason }
    });
    await audit({ operator, action: 'license.revoked', entity: 'license', entityId: id, details: { reason }, ip });
    return json({ license: { id: license.id, status: license.status } });
  }
  if (body.action === 'reinstate') {
    const license = await prisma.license.update({
      where: { id }, data: { status: 'ACTIVE', revokedAt: null, revokeReason: null }
    });
    await audit({ operator, action: 'license.reinstated', entity: 'license', entityId: id, ip });
    return json({ license: { id: license.id, status: license.status } });
  }
  if (body.action) throw new HttpError(400, 'validation', 'Acción desconocida');

  const data = parseLicenseInput(body, { partial: true });
  const license = await prisma.license.update({ where: { id }, data });
  await audit({ operator, action: 'license.updated', entity: 'license', entityId: id,
    details: { before: pick(current, data), after: pick(license, data) }, ip });
  return json({ license: { id: license.id } });
});

function pick(obj, keys) {
  return Object.fromEntries(Object.keys(keys).map((k) => [k, obj[k]]));
}
