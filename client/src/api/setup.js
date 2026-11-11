// API del asistente de configuración de primera ejecución (/setup)
import { requestJson } from '../shared/api/httpClient';

// Token de configuración: solo hace falta si se configura desde otro equipo de la red.
let setupToken = '';

export function setSetupToken(token) {
  setupToken = String(token || '').trim();
}

function setupHeaders() {
  return setupToken ? { 'X-Setup-Token': setupToken } : {};
}

export async function fetchSetupStatus() {
  const json = await requestJson('/api/setup/status', { noStore: true, defaultError: 'No se pudo consultar la configuración' });
  return json.data;
}

export async function detectMdb() {
  const json = await requestJson('/api/setup/detect-mdb', { noStore: true, headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo buscar la base Aldelo' });
  return json.data.found;
}

/** Lista carpetas y archivos .mdb del servidor. Sin `dir`, empieza en la ubicación sugerida. */
export async function browseMdb(dir) {
  const query = dir === undefined ? '' : `?dir=${encodeURIComponent(dir)}`;
  const json = await requestJson(`/api/setup/browse${query}`, { noStore: true, headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo abrir la carpeta' });
  return json.data;
}

/**
 * Abre el diálogo nativo del sistema en el servidor.
 * Devuelve `{ path }`, `{ cancelled: true }` o `{ unavailable: true }` si no hay escritorio (usar el explorador integrado).
 */
export async function pickMdbNative() {
  const json = await requestJson('/api/setup/pick-file', { method: 'POST', headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo abrir el selector de archivos' });
  return json.data;
}

export async function applyDatabase(payload) {
  const json = await requestJson('/api/setup/database', { method: 'POST', body: payload, headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo configurar la base de datos' });
  return json.data;
}

export async function applyBusiness(business) {
  const json = await requestJson('/api/setup/business', { method: 'POST', body: business, headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudieron guardar los datos del negocio' });
  return json.data;
}

export async function markPrinterDone() {
  const json = await requestJson('/api/setup/printer-done', { method: 'POST', headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo guardar la impresora' });
  return json.data;
}

export async function verifyAdmin(pin) {
  const json = await requestJson('/api/setup/verify-admin', { method: 'POST', body: { pin }, headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo verificar el administrador' });
  return json.data;
}

export async function completeSetup() {
  const json = await requestJson('/api/setup/complete', { method: 'POST', headers: setupHeaders(), preferAdminToken: true, defaultError: 'No se pudo finalizar la configuración' });
  return json.data;
}

export const SETUP_QUERY_KEY = ['setup-status'];
