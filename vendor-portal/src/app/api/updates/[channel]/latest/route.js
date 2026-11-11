import { publicKeyInfo } from '@/lib/crypto';
import { handler, HttpError, json } from '@/lib/http';
import { latestRelease } from '@/lib/licensing';

export const runtime = 'nodejs';

// GET /api/updates/:channel/latest → manifiesto firmado { version, url, sha256, signature }
// La firma Ed25519 cubre canonicalJson({ channel, sha256, url, version }).
export const GET = handler(async (_request, { params }) => {
  const { channel } = await params;
  const release = await latestRelease(channel);
  if (!release) throw new HttpError(404, 'no_release', 'No hay versiones publicadas en este canal');
  return json({
    channel: release.channel,
    version: release.version,
    url: release.url,
    sha256: release.sha256,
    signature: release.signature,
    keyId: publicKeyInfo().keyId,
    publishedAt: release.publishedAt.toISOString(),
    notes: release.notes
  });
});
