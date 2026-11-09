export const LICENSE_QUERY_KEY = ['license-status'];

// Estados en los que el equipo no puede operar y debe mostrar la pantalla de activación.
export const LOCKED_STATUSES = ['unlicensed', 'invalid'];

export function isLocked(status) {
  return Boolean(status && LOCKED_STATUSES.includes(status.status));
}
