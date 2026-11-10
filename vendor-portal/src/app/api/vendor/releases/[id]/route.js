import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, handler, json, readJson } from '@/lib/http';
import { requireOperator } from '@/lib/session';

export const runtime = 'nodejs';

// PATCH { yanked: boolean } → retira (o restaura) una versión del canal.
export const PATCH = handler(async (request, { params }) => {
  const operator = await requireOperator(request);
  const { id } = await params;
  const body = await readJson(request);
  const yanked = Boolean(body.yanked);
  const release = await prisma.release.update({ where: { id }, data: { yanked } });
  await audit({ operator, action: yanked ? 'release.yanked' : 'release.restored', entity: 'release', entityId: id,
    details: { channel: release.channel, version: release.version }, ip: clientIp(request) });
  return json({ release: { id: release.id, yanked: release.yanked } });
});
