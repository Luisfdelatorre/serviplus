import { clientIp, handler, json, rateLimit, readJson } from '@/lib/http';
import { activate } from '@/lib/licensing';

export const runtime = 'nodejs';

// POST /api/license/activate  { licenseKey, fingerprint, appVersion } → .lic firmado + envoltura de escrow
export const POST = handler(async (request) => {
  const ip = clientIp(request);
  await rateLimit(`activate:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  const body = await readJson(request);
  const result = await activate({ ...body, ip });
  return json(result);
});
