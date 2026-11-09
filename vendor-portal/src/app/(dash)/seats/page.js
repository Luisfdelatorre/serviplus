import Link from 'next/link';
import { prisma } from '@/lib/db';
import { HEARTBEAT_STALE_MS } from '@/lib/constants';
import { requirePageOperator } from '@/lib/pageAuth';
import { SeatsTable } from '@/components/SeatsTable';

const FILTERS = [
  { id: 'active', label: 'Activos' },
  { id: 'flagged', label: 'Duplicados' },
  { id: 'stale', label: 'Sin heartbeat 24 h' },
  { id: 'all', label: 'Todos' }
];

function whereFor(filter) {
  const staleBefore = new Date(Date.now() - HEARTBEAT_STALE_MS);
  switch (filter) {
    case 'flagged': return { duplicateFlag: true };
    case 'stale': return { status: 'ACTIVE', OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }] };
    case 'all': return undefined;
    default: return { status: 'ACTIVE' };
  }
}

export default async function SeatsPage({ searchParams }) {
  await requirePageOperator();
  const { filter = 'active' } = await searchParams;
  const seats = await prisma.seat.findMany({
    where: whereFor(filter),
    include: { license: { select: { keyLast4: true, restaurant: { select: { name: true } } } } },
    orderBy: [{ duplicateFlag: 'desc' }, { activatedAt: 'desc' }],
    take: 500
  });

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Puestos</h1>
          <p className="dash-page-subtitle">Equipos activados, con su fingerprint, versión y último heartbeat.</p>
        </div>
        <div className="dash-filters">
          {FILTERS.map((f) => (
            <Link key={f.id} href={`/seats?filter=${f.id}`} className={`dash-filter ${filter === f.id ? 'is-active' : ''}`}>{f.label}</Link>
          ))}
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-card-body is-flush">
          <SeatsTable seats={seats} showLicense emptyText="No hay equipos en este filtro." />
        </div>
      </div>
    </>
  );
}
