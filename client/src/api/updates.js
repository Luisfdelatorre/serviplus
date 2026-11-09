// API de actualizaciones del equipo (solo administrador)
import { requestJson } from '../shared/api/httpClient';

export const UPDATES_QUERY_KEY = ['updates-status'];

export async function fetchUpdateStatus() {
  const json = await requestJson('/api/updates/status', { noStore: true, preferAdminToken: true, defaultError: 'No se pudo consultar las actualizaciones' });
  return json.data;
}

export async function checkForUpdates() {
  const json = await requestJson('/api/updates/check', { method: 'POST', preferAdminToken: true, defaultError: 'No se pudo buscar actualizaciones' });
  return json.data;
}

export async function applyUpdate() {
  const json = await requestJson('/api/updates/apply', { method: 'POST', preferAdminToken: true, defaultError: 'No se pudo iniciar la actualización' });
  return json.data;
}
