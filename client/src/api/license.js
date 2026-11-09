// API de licencia del equipo (estado, activación online e importación manual)
import { requestJson } from '../shared/api/httpClient';

export async function fetchLicenseStatus() {
  const json = await requestJson('/api/license/status', {
    noStore: true,
    defaultError: 'No se pudo consultar la licencia'
  });
  return json.data;
}

export async function activateLicense(licenseKey) {
  const json = await requestJson('/api/license/activate', {
    method: 'POST',
    body: { licenseKey },
    preferAdminToken: true,
    defaultError: 'No se pudo activar la licencia'
  });
  return json.data;
}

export async function importLicenseFile(license) {
  const json = await requestJson('/api/license/import', {
    method: 'POST',
    body: { license },
    preferAdminToken: true,
    defaultError: 'No se pudo importar el archivo de licencia'
  });
  return json.data;
}
