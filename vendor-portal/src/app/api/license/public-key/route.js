import { publicKeyInfo } from '@/lib/crypto';
import { handler, json } from '@/lib/http';

export const runtime = 'nodejs';

// GET /api/license/public-key → clave pública Ed25519 (la que se embebe en la app). Es pública por diseño.
export const GET = handler(async () => {
  const { algorithm, spkiBase64, pem, keyId } = publicKeyInfo();
  return json({ algorithm, keyId, spkiBase64, pem });
});
