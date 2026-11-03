// API REST client para Aldelo POS & Serviplus
export async function fetchMenu() {
  const res = await fetch('/api/menu');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error al obtener menú');
  return json.data;
}

export async function fetchEmployees() {
  const res = await fetch('/api/employees');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error al obtener empleados');
  return json.data;
}

export async function fetchActiveOrders() {
  const res = await fetch('/api/orders/active');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error al obtener órdenes activas');
  return json.data;
}

export async function createOrder(payload) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error al crear orden');
  return json.data;
}

export async function updateOrderStatus(orderId, status, tableReady = null) {
  const payload = { status };
  if (tableReady !== null) payload.tableReady = tableReady;
  const res = await fetch(`/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error al actualizar estado');
  return json.data;
}

export async function updateKdsStatus(orderId, kdsStatus, itemChecks = null) {
  const payload = { kdsStatus };
  if (itemChecks) payload.itemChecks = itemChecks;
  const res = await fetch(`/api/orders/${orderId}/kds-status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Error al actualizar KDS');
  return json.data;
}

export async function fetchTables() {
  try {
    const res = await fetch('/api/tables');
    const json = await res.json();
    if (json.success && json.data && json.data.length > 0) return json.data;
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
    const res = await fetch(`/api/orders/${orderId}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, destination })
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error('Error sending digital receipt:', err);
    return { success: true, simulated: true };
  }
}
