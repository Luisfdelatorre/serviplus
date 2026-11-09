import { FEATURE_CATALOG } from '@/lib/constants';
import { fmtDateTime, fmtRelative, isHeartbeatStale, LICENSE_STATUS_LABEL, SEAT_STATUS_LABEL } from '@/lib/format';
import { fingerprintPreview } from '@/lib/fingerprint';

export function LicenseStatusBadge({ license }) {
  const expired = license.expiresAt && new Date(license.expiresAt) <= new Date();
  if (license.status === 'REVOKED') return <span className="dash-badge is-danger">{LICENSE_STATUS_LABEL.REVOKED}</span>;
  if (expired) return <span className="dash-badge is-warn">Expirada</span>;
  return <span className="dash-badge is-ok">{LICENSE_STATUS_LABEL.ACTIVE}</span>;
}

export function SeatStatusBadge({ status }) {
  const cls = { ACTIVE: 'is-ok', RELEASED: '', REVOKED: 'is-danger' }[status] || '';
  return <span className={`dash-badge ${cls}`}>{SEAT_STATUS_LABEL[status] || status}</span>;
}

export function ChannelBadge({ channel }) {
  return <span className={`dash-badge ${channel === 'beta' ? 'is-warn' : 'is-info'}`}>{channel}</span>;
}

export function ExpiryText({ expiresAt }) {
  if (!expiresAt) return <span className="dash-badge is-info">Perpetua</span>;
  return <span>{fmtDateTime(expiresAt)}</span>;
}

const featureLabel = Object.fromEntries(FEATURE_CATALOG.map((f) => [f.id, f.label]));

export function FeatureList({ features }) {
  if (!features?.length) return <span className="dash-muted">Ninguna</span>;
  return (
    <span className="dash-badge-list">
      {features.map((f) => <span key={f} className="dash-badge" title={featureLabel[f] || f}>{f}</span>)}
    </span>
  );
}

export function HeartbeatCell({ at, active }) {
  const stale = active && isHeartbeatStale(at);
  return (
    <span title={fmtDateTime(at)} className={stale ? 'dash-badge is-warn' : ''}>
      {fmtRelative(at)}
    </span>
  );
}

export function FingerprintCell({ fingerprint }) {
  return (
    <span className="dash-fp">
      {fingerprintPreview(fingerprint).map((c) => (
        <span key={c.name} className="dash-fp-row">{c.name}: {c.value}</span>
      ))}
    </span>
  );
}

export function DuplicateBadge({ seat }) {
  if (!seat.duplicateFlag) return null;
  return (
    <span className="dash-badge is-danger" title="El mismo puesto reportó desde otro fingerprint">
      {seat.duplicateOfId ? 'Copia detectada' : 'Fingerprint duplicado'}
    </span>
  );
}
