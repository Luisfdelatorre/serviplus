// API del asistente de configuración de primera ejecución (/setup)
import { requestJson } from '../shared/api/httpClient';

export async function fetchSetupStatus() {
  const json = await requestJson('/api/setup/status', { noStore: true, defaultError: 'No se pudo consultar la configuración' });
  return json.data;
}

export async function detectMdb() {
  const json = await requestJson('/api/setup/detect-mdb', { noStore: true, preferAdminToken: true, defaultError: 'No se pudo buscar la base Aldelo' });
  return json.data.found;
}

export async function applyDatabase(payload) {
  const json = await requestJson('/api/setup/database', { method: 'POST', body: payload, preferAdminToken: true, defaultError: 'No se pudo configurar la base de datos' });
  return json.data;
}

export async function applyBusiness(business) {
  const json = await requestJson('/api/setup/business', { method: 'POST', body: business, preferAdminToken: true, defaultError: 'No se pudieron guardar los datos del negocio' });
  return json.data;
}

export async function markPrinterDone() {
  const json = await requestJson('/api/setup/printer-done', { method: 'POST', preferAdminToken: true, defaultError: 'No se pudo guardar la impresora' });
  return json.data;
}

export async function verifyAdmin(pin) {
  const json = await requestJson('/api/setup/verify-admin', { method: 'POST', body: { pin }, preferAdminToken: true, defaultError: 'No se pudo verificar el administrador' });
  return json.data;
}

export async function completeSetup() {
  const json = await requestJson('/api/setup/complete', { method: 'POST', preferAdminToken: true, defaultError: 'No se pudo finalizar la configuración' });
  return json.data;
}

export const SETUP_QUERY_KEY = ['setup-status'];
