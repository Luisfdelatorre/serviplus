import { clientIp, handler, json, rateLimit, readJson } from '@/lib/http';
import { heartbeat } from '@/lib/licensing';

export const runtime = 'nodejs';

// POST /api/license/heartbeat  { licenseId, fingerprint, appVersion } → { status, revoked, features, expiresAt }
export const POST = handler(async (request) => {
  const ip = clientIp(request);
  const body = await readJson(request);
  rateLimit(`heartbeat:${ip}:${body.licenseId}`, { limit: 60, windowMs: 10 * 60 * 1000 });
  return json(await heartbeat({ ...body, ip }));
});
