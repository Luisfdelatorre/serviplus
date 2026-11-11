import Link from 'next/link';
import { prisma } from '@/lib/db';
import { HEARTBEAT_STALE_MS } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';
import { requirePageOperator } from '@/lib/pageAuth';
import { AuditTable } from '@/components/AuditTable';

export default async function OverviewPage() {
  await requirePageOperator();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - HEARTBEAT_STALE_MS);
  const [restaurants, activeLicenses, activeSeats, flagged, stale, openGrants, latest, recent] = await Promise.all([
    prisma.restaurant.count(),
    prisma.license.count({ where: { status: 'ACTIVE' } }),
    prisma.seat.count({ where: { status: 'ACTIVE' } }),
    prisma.seat.findMany({
      where: { duplicateFlag: true, status: 'ACTIVE' },
      include: { license: { include: { restaurant: true } } },
      orderBy: { activatedAt: 'desc' }
    }),
    prisma.seat.count({
      where: { status: 'ACTIVE', OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }] }
    }),
    prisma.escrowGrant.count({ where: { usedAt: null, cancelledAt: null, expiresAt: { gt: now } } }),
    prisma.release.findMany({ where: { yanked: false }, orderBy: { publishedAt: 'desc' }, take: 20 }),
    prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 12 })
  ]);
  const latestBy = (channel) => latest.find((r) => r.channel === channel)?.version || '—';

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Resumen</h1>
          <p className="dash-page-subtitle">Estado de clientes, licencias y equipos activados.</p>
        </div>
        <div className="dash-actions">
          <Link className="dash-btn is-primary" href="/restaurants?new=1">Nuevo restaurante</Link>
        </div>
      </div>

      <div className="dash-grid is-stats">
        <div className="dash-stat"><div className="dash-stat-label">Restaurantes</div><div className="dash-stat-value">{restaurants}</div></div>
        <div className="dash-stat"><div className="dash-stat-label">Licencias activas</div><div className="dash-stat-value">{activeLicenses}</div></div>
        <div className="dash-stat"><div className="dash-stat-label">Puestos activos</div><div className="dash-stat-value">{activeSeats}</div></div>
        <div className={`dash-stat ${flagged.length ? 'is-alert' : ''}`}>
          <div className="dash-stat-label">Duplicados</div><div className="dash-stat-value">{flagged.length}</div>
        </div>
        <div className={`dash-stat ${stale ? 'is-warn' : ''}`}>
          <div className="dash-stat-label">Sin heartbeat 24 h</div><div className="dash-stat-value">{stale}</div>
        </div>
        <div className="dash-stat"><div className="dash-stat-label">Restauraciones abiertas</div><div className="dash-stat-value">{openGrants}</div></div>
        <div className="dash-stat"><div className="dash-stat-label">stable / beta</div><div className="dash-stat-value dash-mono">{latestBy('stable')} / {latestBy('beta')}</div></div>
      </div>

      {flagged.length > 0 && (
        <div className="dash-card is-danger">
          <div className="dash-card-header"><h2 className="dash-card-title">Fingerprints duplicados por revisar</h2></div>
          <div className="dash-card-body is-flush dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>Restaurante</th><th>Licencia</th><th>Activado</th><th /></tr></thead>
              <tbody>
                {flagged.map((s) => (
                  <tr key={s.id} className="is-flagged">
                    <td>{s.license.restaurant.name}</td>
                    <td className="dash-mono">…{s.license.keyLast4}</td>
                    <td>{fmtDateTime(s.activatedAt)}</td>
                    <td className="dash-table-actions"><Link href={`/licenses/${s.licenseId}`}>Revisar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Actividad reciente</h2>
          <Link href="/audit">Ver todo</Link>
        </div>
        <div className="dash-card-body is-flush"><AuditTable entries={recent} /></div>
      </div>
    </>
  );
}
