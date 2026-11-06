// API REST client para Aldelo POS & Serviplus (centralizado sobre httpClient)
import { requestJson, setAuthToken } from '../shared/api/httpClient';
import { enqueueOfflineOrder, flushOrderOutbox } from '../shared/offline/orderOutbox';

export async function fetchMenu() {
  const json = await requestJson('/api/menu', {
    noStore: true,
    defaultError: 'Error al obtener menú'
  });
  return json.data;
}

export async function fetchEmployees() {
  const json = await requestJson('/api/employees', {
    noStore: true,
    defaultError: 'Error al obtener empleados'
  });
  return json.data;
}

export async function fetchActiveOrders() {
  const json = await requestJson('/api/orders/active', {
    noStore: true,
    defaultError: 'Error al obtener órdenes activas'
  });
  return json.data;
}

export async function createOrder(payload) {
  try {
    const json = await requestJson('/api/orders', {
      method: 'POST',
      body: payload,
      defaultError: 'Error al crear orden'
    });
    // Aprovechar conexión exitosa para vaciar cola offline si existía
    flushOrderOutbox().catch(() => {});
    return json.data;
  } catch (err) {
    // Si es error de red (sin código HTTP o navegador offline), encolar en Outbox local
    if (!err.status && (typeof navigator === 'undefined' || !navigator.onLine || err.name === 'TypeError')) {
      return enqueueOfflineOrder(payload);
    }
    throw err;
  }
}

export async function updateOrderStatus(orderId, status, tableReady = null) {
  const payload = { status };
  if (tableReady !== null) payload.tableReady = tableReady;
  const json = await requestJson(`/api/orders/${orderId}/status`, {
    method: 'PUT',
    body: payload,
    defaultError: 'Error al actualizar estado'
  });
  return json.data;
}

export async function updateKdsStatus(orderId, kdsStatus, itemChecks = null) {
  const payload = { kdsStatus };
  if (itemChecks) payload.itemChecks = itemChecks;
  const json = await requestJson(`/api/orders/${orderId}/kds-status`, {
    method: 'PUT',
    body: payload,
    defaultError: 'Error al actualizar KDS'
  });
  return json.data;
}

export async function fetchTables() {
  try {
    const json = await requestJson('/api/tables', {
      defaultError: 'Error al obtener mesas'
    });
    if (json && json.data && json.data.length > 0) return json.data;
  } catch (e) {
    console.error('Error fetching tables:', e);
  }
  return Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: String(i + 1),
    groupId: 1,
    groupName: 'Main Dining Room'
  }));
}

export async function sendDigitalReceipt(orderId, type, destination) {
  try {
    return await requestJson(`/api/orders/${orderId}/receipt`, {
      method: 'POST',
      body: { type, destination },
      defaultError: 'Error al enviar recibo digital'
    });
  } catch (err) {
    console.error('Error sending digital receipt:', err);
    return { success: false, error: err.message };
  }
}

// 7b. Enviar mensaje de WhatsApp (Meta Graph API Cloud v25.0)
export async function sendWhatsAppMessage(to, body, extra = {}) {
  return await requestJson('/api/whatsapp/send', {
    method: 'POST',
    body: { to, body, ...extra },
    defaultError: 'Error al enviar mensaje de WhatsApp'
  });
}

// 8. Crear QR Oficial de Bancolombia / Nequi (Wompi)
export async function createWompiQr(orderId, amount, customerEmail = 'kiosco@serviplus.pos', extra = {}) {
  const json = await requestJson('/api/payments/wompi/qr', {
    method: 'POST',
    body: { orderId, amount, customerEmail, ...extra },
    defaultError: 'Error al generar código QR de Bancolombia'
  });
  return json.data;
}

// 8b. Consultar estado de transacción Wompi
export async function fetchWompiTransactionStatus(transactionId) {
  const json = await requestJson(`/api/payments/wompi/status/${transactionId}`, {
    noStore: true,
    defaultError: 'Error al consultar estado del pago'
  });
  return json ? json.data : null;
}

// 9. Autenticación de Administrador Aldelo (SecurityLevel <= 2)
export async function adminLogin(pin) {
  const json = await requestJson('/api/admin/auth', {
    method: 'POST',
    body: { pin },
    defaultError: 'Código de administrador inválido'
  });
  if (json.data && json.data.token) {
    setAuthToken(json.data.token, { isAdmin: true });
  }
  return json.data;
}

// 9b. Autenticación de Empleado / Cajero / Terminal General
export async function employeeLogin(pin) {
  const json = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { pin },
    defaultError: 'Código de empleado inválido'
  });
  if (json.data && json.data.token) {
    setAuthToken(json.data.token, { isAdmin: Boolean(json.data.employee?.isAdmin) });
  }
  return json.data;
}

// 10. Consultar configuración pública del kiosco y restaurante
export async function fetchPublicConfig() {
  try {
    const json = await requestJson('/api/config/public', {
      defaultError: 'Error al obtener configuración pública'
    });
    if (json && json.success) return json.data;
  } catch (err) {
    console.warn('[Config] Error obteniendo configuración pública, usando defaults locales:', err);
  }
  return null;
}

// 11. Consultar configuración del sistema (Admin)
export async function getAdminConfig() {
  const json = await requestJson('/api/admin/config', {
    preferAdminToken: true,
    defaultError: 'Error al obtener configuración'
  });
  return json.data;
}

// 12. Guardar configuración del sistema en caliente (Admin)
export async function saveAdminConfig(configPayload) {
  const json = await requestJson('/api/admin/config', {
    method: 'POST',
    body: configPayload,
    preferAdminToken: true,
    defaultError: 'Error al guardar configuración'
  });
  return json.data;
}

// 13. Obtener todos los productos (incluyendo agotados) para administración
export async function fetchAdminProducts() {
  const json = await requestJson('/api/products/admin', {
    noStore: true,
    defaultError: 'Error al obtener productos'
  });
  return json.data;
}

// 14. Activar o desactivar producto (Agotado / 86'd)
export async function toggleProductActive(id, isActive) {
  const json = await requestJson(`/api/products/${id}/toggle-active`, {
    method: 'POST',
    body: { isActive },
    defaultError: 'Error al actualizar disponibilidad'
  });
  return json.data;
}

// 15. Consultar turno de caja activo (Arqueo en vivo)
export async function fetchCurrentCashShift() {
  const json = await requestJson('/api/cashier/shift/current', {
    noStore: true,
    defaultError: 'Error al consultar turno de caja'
  });
  return json.data;
}

// 16. Abrir turno de caja
export async function openCashShift({ cashierId, cashierName, initialCash, notes }) {
  const json = await requestJson('/api/cashier/shift/open', {
    method: 'POST',
    body: { cashierId, cashierName, initialCash, notes },
    defaultError: 'Error al abrir turno de caja'
  });
  return json.data;
}

// 17. Cerrar turno de caja (Corte Z)
export async function closeCashShift({ actualCashInDrawer, closedBy, notes }) {
  const json = await requestJson('/api/cashier/shift/close', {
    method: 'POST',
    body: { actualCashInDrawer, closedBy, notes },
    defaultError: 'Error al cerrar turno de caja'
  });
  return json.data;
}

// 18. Historial de turnos de caja
export async function fetchCashShiftHistory() {
  const json = await requestJson('/api/cashier/shift/history', {
    noStore: true,
    defaultError: 'Error al obtener historial de turnos'
  });
  return json.data;
}

// 19. Consultar estado y configuración de la impresora térmica
export async function fetchPrinterStatus() {
  const json = await requestJson('/api/printer/status', {
    noStore: true,
    defaultError: 'Error al consultar estado de impresora'
  });
  return json.data;
}

// 20. Listar todas las impresoras instaladas en Windows
export async function fetchPrinterList() {
  const json = await requestJson('/api/printer/list', {
    noStore: true,
    defaultError: 'Error al listar impresoras'
  });
  return json.printers || [];
}

// 21. Guardar configuración de la impresora térmica
export async function savePrinterConfig(printerSettings) {
  const json = await requestJson('/api/printer/config', {
    method: 'POST',
    body: printerSettings,
    defaultError: 'Error al guardar configuración de impresora'
  });
  return json.data;
}

// 22. Imprimir ticket de prueba de diagnóstico
export async function printTestTicket(printerName = null) {
  return await requestJson('/api/printer/test', {
    method: 'POST',
    body: { printerName },
    defaultError: 'Error al imprimir ticket de prueba'
  });
}

// 23. Imprimir orden (por ID o por payload directo)
export async function printOrderTicket(orderDataOrId, options = {}) {
  let url = '/api/printer/order';
  let body = {};

  if (typeof orderDataOrId === 'number' || typeof orderDataOrId === 'string') {
    url = `/api/printer/order/${orderDataOrId}`;
    body = { ...options };
  } else {
    body = { ...orderDataOrId, ...options };
  }

  return await requestJson(url, {
    method: 'POST',
    body,
    defaultError: 'Error al enviar orden a la impresora'
  });
}

// 24. Imprimir comprobante de turno de caja (Apertura o Cierre Z)
export async function printCashShiftSlip(shiftData, isClosing = false, printerName = null) {
  return await requestJson('/api/printer/shift', {
    method: 'POST',
    body: { shiftData, isClosing, printerName },
    defaultError: 'Error al imprimir comprobante de turno'
  });
}

// 25. Abrir gaveta / cajón monedero
export async function openCashDrawer(printerName = null) {
  return await requestJson('/api/printer/drawer/open', {
    method: 'POST',
    body: { printerName },
    defaultError: 'Error al abrir gaveta monedero'
  });
}

// 26. Consultar bitácora de auditoría POS (Admin)
export async function fetchAuditLogs(limit = 100) {
  const json = await requestJson(`/api/admin/audit?limit=${limit}`, {
    preferAdminToken: true,
    noStore: true,
    defaultError: 'Error al obtener bitácora de auditoría'
  });
  return json.data || [];
}
