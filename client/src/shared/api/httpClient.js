/**
 * Cliente HTTP centralizado para Serviplus POS.
 *
 * - Adjunta automáticamente el JWT de sesión (`admin_session_token` o `terminal_session_token`)
 *   en la cabecera `Authorization: Bearer <token>`.
 * - Desactiva caché cuando se solicita (`noStore: true`).
 * - Estandariza el manejo de errores y desenvuelve `{ success, data }` cuando `unwrap: true`.
 */

const ADMIN_TOKEN_KEY = 'admin_session_token';
const TERMINAL_TOKEN_KEY = 'terminal_session_token';

export function getActiveAuthToken(preferAdmin = false) {
  try {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const terminalToken = localStorage.getItem(TERMINAL_TOKEN_KEY);
    if (preferAdmin) return adminToken || terminalToken || null;
    return terminalToken || adminToken || null;
  } catch (_) {
    return null;
  }
}

export function setAuthToken(token, { isAdmin = false } = {}) {
  try {
    if (!token) return;
    if (isAdmin) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.setItem(TERMINAL_TOKEN_KEY, token);
    }
  } catch (_) {}
}

export function clearAuthTokens({ adminOnly = false } = {}) {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    if (!adminOnly) {
      localStorage.removeItem(TERMINAL_TOKEN_KEY);
    }
  } catch (_) {}
}

export async function requestJson(
  path,
  {
    method = 'GET',
    body = undefined,
    headers = {},
    noStore = false,
    preferAdminToken = false,
    defaultError = 'Error de comunicación con el servidor'
  } = {}
) {
  const token = getActiveAuthToken(preferAdminToken || path.startsWith('/api/admin'));
  const finalHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(noStore ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };

  let finalPath = path;
  if (noStore && method === 'GET') {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = `${path}${sep}_t=${Date.now()}`;
  }

  const res = await fetch(finalPath, {
    method,
    headers: finalHeaders,
    cache: noStore ? 'no-store' : 'default',
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    if (!res.ok) throw new Error(`${defaultError} (HTTP ${res.status})`);
    return null;
  }

  // Licencia ausente o inválida: cualquier pantalla pasa a la activación.
  if (res.status === 403 && json && json.code === 'LICENSE_REQUIRED' && window.location.pathname !== '/activate') {
    window.location.assign('/activate');
  }

  if (!res.ok || (json && json.success === false && !json.simulated)) {
    throw new Error((json && json.error) || defaultError);
  }

  return json;
}

