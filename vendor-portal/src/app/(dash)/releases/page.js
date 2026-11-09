import Link from 'next/link';
import { prisma } from '@/lib/db';
import { CHANNELS } from '@/lib/constants';
import { publicKeyInfo } from '@/lib/crypto';
import { fmtDateTime } from '@/lib/format';
import { compareSemver } from '@/lib/licensing';
import { requirePageOperator } from '@/lib/pageAuth';
import { ReleaseFormButton, YankButton } from '@/components/ReleaseActions';

function ReleaseStatus({ release, latestId }) {
  if (release.yanked) return <span className="dash-badge is-danger">Retirada</span>;
  if (release.id === latestId) return <span className="dash-badge is-ok">Actual</span>;
  return <span className="dash-badge">Anterior</span>;
}

export default async function ReleasesPage({ searchParams }) {
  await requirePageOperator();
  const { channel: raw = 'stable' } = await searchParams;
  const channel = CHANNELS.includes(raw) ? raw : 'stable';
  const [releases, counts] = await Promise.all([
    prisma.release.findMany({ where: { channel } }),
    prisma.license.groupBy({ by: ['channel'], where: { status: 'ACTIVE' }, _count: true })
  ]);
  releases.sort((a, b) => compareSemver(b.version, a.version));
  const latest = releases.find((r) => !r.yanked);
  const inChannel = counts.find((c) => c.channel === channel)?._count || 0;
  const key = publicKeyInfo();

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Versiones</h1>
          <p className="dash-page-subtitle">
            Manifiestos firmados que sirve <span className="dash-mono">GET /api/updates/{channel}/latest</span>.
            {' '}{inChannel} licencias activas en este canal.
          </p>
        </div>
        <div className="dash-actions">
          <div className="dash-filters">
            {CHANNELS.map((c) => (
              <Link key={c} href={`/releases?channel=${c}`} className={`dash-filter ${c === channel ? 'is-active' : ''}`}>{c}</Link>
            ))}
          </div>
          <ReleaseFormButton channel={channel} />
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Canal {channel}</h2>
          <span>Última: <strong className="dash-mono">{latest?.version || '—'}</strong></span>
        </div>
        <div className="dash-card-body is-flush dash-table-wrap">
          {releases.length === 0 ? <div className="dash-empty">Sin versiones publicadas en {channel}.</div> : (
            <table className="dash-table">
              <thead><tr><th>Versión</th><th>Estado</th><th>Paquete</th><th>SHA-256</th><th>Publicada</th><th>Notas</th><th /></tr></thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id} className={r.yanked ? 'is-muted' : ''}>
                    <td className="dash-mono">{r.version}</td>
                    <td><ReleaseStatus release={r} latestId={latest?.id} /></td>
                    <td className="dash-small"><a href={r.url} rel="noreferrer noopener" target="_blank">{new URL(r.url).pathname.split('/').pop() || r.url}</a></td>
                    <td className="dash-mono dash-muted">{r.sha256.slice(0, 12)}…</td>
                    <td className="dash-small">{fmtDateTime(r.publishedAt)}</td>
                    <td className="dash-small dash-muted">{r.notes || '—'}</td>
                    <td className="dash-table-actions"><YankButton release={{ id: r.id, version: r.version, yanked: r.yanked }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header"><h2 className="dash-card-title">Clave pública de firma</h2><span className="dash-mono dash-muted">keyId {key.keyId}</span></div>
        <div className="dash-card-body">
          <p className="dash-small dash-muted">Es la que se embebe en la app para verificar .lic y manifiestos. La clave privada nunca sale del servidor.</p>
          <pre className="dash-pre">{key.pem}</pre>
        </div>
      </div>
    </>
  );
}
