import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { signPayload } from '@/lib/crypto';
import { clientIp, handler, HttpError, json, readJson, str } from '@/lib/http';
import { manifestPayload, normalizeChannel, parseSemver } from '@/lib/licensing';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

// Registra una versión publicada (el paquete lo genera CI) y firma su manifiesto.
export const POST = handler(async (request) => {
  const operator = await requireOperator(request);
  const body = await readJson(request);
  const channel = normalizeChannel(body.channel);
  const version = str(body.version, { required: true, field: 'Versión', max: 40 }).replace(/^v/, '');
  if (!parseSemver(version)) throw new HttpError(400, 'validation', 'Versión inválida (formato X.Y.Z)');
  const url = str(body.url, { required: true, field: 'URL', max: 500 });
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new HttpError(400, 'validation', 'URL inválida');
  }
  if (parsedUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new HttpError(400, 'validation', 'La URL debe ser https');
  }
  const sha256 = str(body.sha256, { required: true, field: 'SHA-256', max: 64 }).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new HttpError(400, 'validation', 'SHA-256 debe tener 64 caracteres hex');

  const payload = manifestPayload({ channel, version, url, sha256 });
  const release = await prisma.release.create({
    data: { ...payload, signature: signPayload(payload), notes: str(body.notes, { max: 4000, field: 'Notas' }) }
  });
  await audit({ operator, action: 'release.published', entity: 'release', entityId: release.id,
    details: { channel, version }, ip: clientIp(request) });
  return json({ release: { id: release.id } }, 201);
});
