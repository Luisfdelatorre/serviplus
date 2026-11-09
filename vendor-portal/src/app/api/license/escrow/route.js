import { clientIp, handler, json, rateLimit, readJson } from '@/lib/http';
import { storeEscrow } from '@/lib/licensing';

export const runtime = 'nodejs';

// POST /api/license/escrow  { licenseId, fingerprint, wrappedKey } → guarda la clave de datos envuelta
export const POST = handler(async (request) => {
  const ip = clientIp(request);
  await rateLimit(`escrow:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  const body = await readJson(request);
  return json(await storeEscrow({ ...body, ip }));
});
