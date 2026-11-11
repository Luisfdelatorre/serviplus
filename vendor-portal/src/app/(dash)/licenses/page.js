import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { requirePageOperator } from '@/lib/pageAuth';
import { ChannelBadge, ExpiryText, FeatureList, LicenseStatusBadge } from '@/components/badges';

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'revoked', label: 'Revocadas' },
  { id: 'unactivated', label: 'Sin activar' },
  { id: 'beta', label: 'Canal beta' }
];

function whereFor(filter) {
  switch (filter) {
    case 'active': return { status: 'ACTIVE' };
    case 'revoked': return { status: 'REVOKED' };
    case 'unactivated': return { status: 'ACTIVE', seats: { none: {} } };
    case 'beta': return { channel: 'beta' };
    default: return undefined;
  }
}

export default async function LicensesPage({ searchParams }) {
  await requirePageOperator();
  const { filter = 'all' } = await searchParams;
  const licenses = await prisma.license.findMany({
    where: whereFor(filter),
    include: { restaurant: true, seats: { where: { status: 'ACTIVE' } }, escrow: { select: { storedAt: true } } },
    orderBy: { issuedAt: 'desc' }
  });

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Licencias</h1>
          <p className="dash-page-subtitle">Para emitir una licencia, entra al restaurante.</p>
        </div>
        <div className="dash-filters">
          {FILTERS.map((f) => (
            <Link key={f.id} href={`/licenses?filter=${f.id}`} className={`dash-filter ${filter === f.id ? 'is-active' : ''}`}>{f.label}</Link>
          ))}
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-card-body is-flush dash-table-wrap">
          {licenses.length === 0 ? <div className="dash-empty">No hay licencias en este filtro.</div> : (
            <table className="dash-table">
              <thead><tr><th>Clave</th><th>Restaurante</th><th>Estado</th><th>Canal</th><th>Features</th><th>Vence</th><th>Equipos</th><th>Escrow</th><th>Emitida</th></tr></thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id} className={l.seats.some((s) => s.duplicateFlag) ? 'is-flagged' : ''}>
                    <td><Link className="dash-mono" href={`/licenses/${l.id}`}>SVP-…-{l.keyLast4}</Link></td>
                    <td><Link href={`/restaurants/${l.restaurantId}`}>{l.restaurant.name}</Link></td>
                    <td><LicenseStatusBadge license={l} /></td>
                    <td><ChannelBadge channel={l.channel} /></td>
                    <td><FeatureList features={l.features} /></td>
                    <td><ExpiryText expiresAt={l.expiresAt} /></td>
                    <td>{l.seats.length} / {l.maxSeats}</td>
                    <td>{l.escrow?.storedAt ? <span className="dash-badge is-ok">Custodiada</span> : <span className="dash-badge">Pendiente</span>}</td>
                    <td className="dash-small">{fmtDateTime(l.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
