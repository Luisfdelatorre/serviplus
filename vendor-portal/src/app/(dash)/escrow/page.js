import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fmtDateTime, grantState } from '@/lib/format';
import { requirePageOperator } from '@/lib/pageAuth';

function LastGrant({ grant, now }) {
  if (!grant) return '—';
  const state = grantState(grant, now);
  if (state.open) return <span className="dash-badge is-warn">Abierta hasta {fmtDateTime(grant.expiresAt)}</span>;
  return <>{state.label} · {grant.operator.name}</>;
}

export default async function EscrowPage() {
  await requirePageOperator();
  const now = new Date();
  const licenses = await prisma.license.findMany({
    include: {
      restaurant: { select: { name: true } },
      escrow: { select: { storedAt: true, wrappedSha: true } },
      escrowGrants: { orderBy: { createdAt: 'desc' }, take: 1, include: { operator: { select: { name: true } } } }
    },
    orderBy: { issuedAt: 'desc' }
  });

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Custodia de claves</h1>
          <p className="dash-page-subtitle">
            Cada instalación sube su clave de datos envuelta. Solo se recupera con una autorización de restauración (un uso, 24 h).
          </p>
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-card-body is-flush dash-table-wrap">
          {licenses.length === 0 ? <div className="dash-empty">Sin licencias.</div> : (
            <table className="dash-table">
              <thead><tr><th>Restaurante</th><th>Licencia</th><th>Clave custodiada</th><th>Huella</th><th>Última autorización</th><th /></tr></thead>
              <tbody>
                {licenses.map((l) => {
                  const g = l.escrowGrants[0];
                  return (
                    <tr key={l.id}>
                      <td>{l.restaurant.name}</td>
                      <td className="dash-mono">SVP-…-{l.keyLast4}</td>
                      <td>{l.escrow?.storedAt
                        ? <span className="dash-badge is-ok">Sí · {fmtDateTime(l.escrow.storedAt)}</span>
                        : <span className="dash-badge">Pendiente</span>}</td>
                      <td className="dash-mono dash-muted">{l.escrow?.wrappedSha ? `${l.escrow.wrappedSha.slice(0, 12)}…` : '—'}</td>
                      <td className="dash-small"><LastGrant grant={g} now={now} /></td>
                      <td className="dash-table-actions"><Link href={`/licenses/${l.id}`}>Gestionar</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
