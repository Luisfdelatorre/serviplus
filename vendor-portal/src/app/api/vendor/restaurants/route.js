import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, handler, json, readJson } from '@/lib/http';
import { parseRestaurantInput } from '@/lib/restaurants';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

export const GET = handler(async (request) => {
  await requireOperator(request);
  const restaurants = await prisma.restaurant.findMany({ orderBy: { name: 'asc' } });
  return json({ restaurants });
});

export const POST = handler(async (request) => {
  const operator = await requireOperator(request);
  const data = parseRestaurantInput(await readJson(request));
  const restaurant = await prisma.restaurant.create({ data });
  await audit({ operator, action: 'restaurant.created', entity: 'restaurant', entityId: restaurant.id,
    details: { name: restaurant.name, nit: restaurant.nit }, ip: clientIp(request) });
  return json({ restaurant }, 201);
});
