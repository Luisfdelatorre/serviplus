import { HEARTBEAT_STALE_MS } from './constants';

const TZ = 'America/Bogota';
const dateFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ });

export function fmtDate(d) {
  return d ? dateFmt.format(new Date(d)) : '—';
}

export function fmtDateTime(d) {
  return d ? dateTimeFmt.format(new Date(d)) : '—';
}

export function fmtRelative(d, now = Date.now()) {
  if (!d) return 'nunca';
  const diff = Math.round((now - new Date(d).getTime()) / 1000);
  if (diff < 60) return 'hace segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export function isHeartbeatStale(d, now = Date.now()) {
  return !d || now - new Date(d).getTime() > HEARTBEAT_STALE_MS;
}

/** Estado de una autorización de recuperación de escrow. */
export function grantState(grant, now = new Date()) {
  if (grant.usedAt) return { label: 'Usada', cls: 'is-info', open: false };
  if (grant.cancelledAt) return { label: 'Cancelada', cls: '', open: false };
  if (grant.expiresAt <= now) return { label: 'Expirada', cls: '', open: false };
  return { label: 'Abierta', cls: 'is-warn', open: true };
}

export const LICENSE_STATUS_LABEL = { ACTIVE: 'Activa', REVOKED: 'Revocada' };
export const SEAT_STATUS_LABEL = { ACTIVE: 'Activo', RELEASED: 'Liberado', REVOKED: 'Revocado' };
