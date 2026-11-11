import Link from 'next/link';
import { fmtDateTime } from '@/lib/format';
import { DuplicateBadge, FingerprintCell, HeartbeatCell, SeatStatusBadge } from './badges';
import { SeatActions } from './LicenseActions';

/** Tabla de puestos (equipos activados). `showLicense` añade la columna de restaurante/licencia. */
export function SeatsTable({ seats, showLicense = false, emptyText = 'Sin equipos activados todavía.' }) {
  if (!seats.length) return <div className="dash-empty">{emptyText}</div>;
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            {showLicense && <th>Restaurante / licencia</th>}
            <th>Estado</th><th>Fingerprint</th><th>Versión app</th><th>Último heartbeat</th><th>Activado</th><th>IP</th><th />
          </tr>
        </thead>
        <tbody>
          {seats.map((s) => (
            <tr key={s.id} className={`${s.duplicateFlag ? 'is-flagged' : ''} ${s.status !== 'ACTIVE' ? 'is-muted' : ''}`}>
              {showLicense && (
                <td>
                  <Link href={`/licenses/${s.licenseId}`}>{s.license.restaurant.name}</Link>
                  <div className="dash-mono dash-small dash-muted">SVP-…-{s.license.keyLast4}</div>
                </td>
              )}
              <td>
                <span className="dash-badge-list"><SeatStatusBadge status={s.status} /><DuplicateBadge seat={s} /></span>
                {s.statusReason && <div className="dash-small dash-muted">{s.statusReason === 'duplicate_fingerprint' ? 'Copia de otro equipo' : s.statusReason}</div>}
              </td>
              <td><FingerprintCell fingerprint={s.fingerprint} /></td>
              <td className="dash-mono">{s.appVersion || '—'}</td>
              <td><HeartbeatCell at={s.lastHeartbeatAt} active={s.status === 'ACTIVE'} /></td>
              <td className="dash-small">{fmtDateTime(s.activatedAt)}</td>
              <td className="dash-mono dash-muted">{s.lastIp || '—'}</td>
              <td className="dash-table-actions"><SeatActions seat={{ id: s.id, status: s.status, duplicateFlag: s.duplicateFlag }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
