import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { generateLicenseKey, hashLicenseKey } from '@/lib/crypto';
import { clientIp, handler, json } from '@/lib/http';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

// Genera una clave nueva (la anterior deja de servir para activar). Los puestos activos no se afectan.
export const POST = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const licenseKey = generateLicenseKey();
  await prisma.license.update({
    where: { id }, data: { keyHash: hashLicenseKey(licenseKey), keyLast4: licenseKey.slice(-4) }
  });
  await audit({ operator, action: 'license.key_rotated', entity: 'license', entityId: id, ip: clientIp(request) });
  return json({ licenseKey });
});
