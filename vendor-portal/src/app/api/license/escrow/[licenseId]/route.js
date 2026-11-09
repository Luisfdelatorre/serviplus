import { clientIp, handler, HttpError, json, rateLimit } from '@/lib/http';
import { retrieveEscrow } from '@/lib/licensing';

export const runtime = 'nodejs';

/** El fingerprint viaja en la cabecera X-Fingerprint: JSON en base64url (o un string plano). */
function fingerprintFromHeader(request) {
  const raw = request.headers.get('x-fingerprint');
  if (!raw) throw new HttpError(400, 'invalid_fingerprint', 'Falta la cabecera X-Fingerprint');
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // no era JSON en base64url: se usa como string
  }
  return raw;
}

// GET /api/license/escrow/:licenseId → solo tras autorización de restauración en el panel (un uso, 24 h)
export const GET = handler(async (request, { params }) => {
  const { licenseId } = await params;
  const ip = clientIp(request);
  await rateLimit(`escrow-get:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  return json(await retrieveEscrow({ licenseId, fingerprint: fingerprintFromHeader(request), ip }));
});
