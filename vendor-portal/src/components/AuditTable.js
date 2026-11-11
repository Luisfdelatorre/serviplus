import Link from 'next/link';
import { fmtDateTime } from '@/lib/format';

const ACTION_LABEL = {
  'operator.login': 'Inicio de sesión',
  'restaurant.created': 'Restaurante creado',
  'restaurant.updated': 'Restaurante editado',
  'restaurant.deleted': 'Restaurante eliminado',
  'license.issued': 'Licencia emitida',
  'license.updated': 'Licencia editada',
  'license.revoked': 'Licencia revocada',
  'license.reinstated': 'Licencia reactivada',
  'license.key_rotated': 'Clave regenerada',
  'seat.activated': 'Equipo activado',
  'seat.reactivated': 'Equipo reactivado',
  'seat.release': 'Puesto liberado',
  'seat.revoke': 'Puesto revocado',
  'seat.clear_flag': 'Marca de duplicado retirada',
  'seat.duplicate_detected': 'Copia detectada',
  'heartbeat.unregistered': 'Heartbeat sin puesto',
  'escrow.stored': 'Clave custodiada',
  'escrow.rotated': 'Clave custodiada reemplazada',
  'escrow.grant_created': 'Restauración autorizada',
  'escrow.grant_cancelled': 'Autorización cancelada',
  'escrow.grant_denied_password': 'Autorización rechazada (contraseña)',
  'escrow.retrieved': 'Clave recuperada',
  'escrow.retrieval_denied': 'Recuperación denegada',
  'release.published': 'Versión publicada',
  'release.yanked': 'Versión retirada',
  'release.restored': 'Versión restaurada'
};

const DANGER = new Set(['license.revoked', 'seat.revoke', 'seat.duplicate_detected', 'escrow.retrieved',
  'escrow.retrieval_denied', 'escrow.grant_denied_password', 'heartbeat.unregistered']);

function entityLink(e) {
  if (e.entity === 'license' && e.entityId) return <Link href={`/licenses/${e.entityId}`}>Licencia</Link>;
  if (e.entity === 'restaurant' && e.entityId) return <Link href={`/restaurants/${e.entityId}`}>Restaurante</Link>;
  if (e.entity === 'release') return <Link href="/releases">Versión</Link>;
  return <span className="dash-muted">{e.entity}</span>;
}

function summary(details) {
  if (!details || typeof details !== 'object') return '';
  const parts = [];
  if (details.reason) parts.push(`Motivo: ${details.reason}`);
  if (details.name) parts.push(details.name);
  if (details.version) parts.push(`${details.channel} ${details.version}`);
  if (details.appVersion) parts.push(`v${details.appVersion}`);
  return parts.join(' · ');
}

export function AuditTable({ entries }) {
  if (!entries.length) return <div className="dash-empty">Sin actividad todavía.</div>;
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Sobre</th><th>Detalle</th><th>IP</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="dash-small">{fmtDateTime(e.at)}</td>
              <td>{e.actor === 'app' ? <span className="dash-badge">app</span> : e.actor}</td>
              <td><span className={`dash-badge ${DANGER.has(e.action) ? 'is-danger' : ''}`}>{ACTION_LABEL[e.action] || e.action}</span></td>
              <td>{entityLink(e)}</td>
              <td className="dash-small dash-muted">{summary(e.details)}</td>
              <td className="dash-mono dash-muted">{e.ip || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
