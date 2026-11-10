import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { generateLicenseKey, hashLicenseKey } from '@/lib/crypto';
import { clientIp, handler, HttpError, json, readJson } from '@/lib/http';
import { parseLicenseInput } from '@/lib/licenseInput';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

// Emite una licencia. La clave completa se devuelve SOLO en esta respuesta; luego solo se guarda su hash.
export const POST = handler(async (request) => {
  const operator = await requireOperator(request);
  const body = await readJson(request);
  const restaurant = await prisma.restaurant.findUnique({ where: { id: String(body.restaurantId || '') } });
  if (!restaurant) throw new HttpError(400, 'validation', 'Restaurante no encontrado');
  const data = parseLicenseInput(body);
  const licenseKey = generateLicenseKey();

  const license = await prisma.license.create({
    data: { ...data, restaurantId: restaurant.id, keyHash: hashLicenseKey(licenseKey), keyLast4: licenseKey.slice(-4) }
  });
  await audit({ operator, action: 'license.issued', entity: 'license', entityId: license.id,
    details: { restaurantId: restaurant.id, features: license.features, channel: license.channel,
      expiresAt: license.expiresAt, maxSeats: license.maxSeats }, ip: clientIp(request) });
  return json({ license: { id: license.id, keyLast4: license.keyLast4 }, licenseKey }, 201);
});
