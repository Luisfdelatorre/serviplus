import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, handler, HttpError, json, readJson } from '@/lib/http';
import { parseRestaurantInput } from '@/lib/restaurants';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

export const PATCH = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const data = parseRestaurantInput(await readJson(request), { partial: true });
  const restaurant = await prisma.restaurant.update({ where: { id }, data });
  await audit({ operator, action: 'restaurant.updated', entity: 'restaurant', entityId: id,
    details: { fields: Object.keys(data) }, ip: clientIp(request) });
  return json({ restaurant });
});

export const DELETE = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const count = await prisma.license.count({ where: { restaurantId: id } });
  if (count > 0) {
    throw new HttpError(409, 'has_licenses', 'No se puede eliminar: el restaurante tiene licencias. Revócalas en su lugar.');
  }
  const restaurant = await prisma.restaurant.delete({ where: { id } });
  await audit({ operator, action: 'restaurant.deleted', entity: 'restaurant', entityId: id,
    details: { name: restaurant.name, nit: restaurant.nit }, ip: clientIp(request) });
  return json({ ok: true });
});
