import { requestJson } from '../api/httpClient';

const OUTBOX_STORAGE_KEY = 'sp_offline_order_outbox';
const listeners = new Set();
let isFlushing = false;

function readQueue() {
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
  } catch (_) {}
  notifyListeners(queue.length);
}

function notifyListeners(count) {
  listeners.forEach((cb) => {
    try {
      cb(count);
    } catch (_) {}
  });
}

export function getOutboxCount() {
  return readQueue().length;
}

export function subscribeOutbox(callback) {
  listeners.add(callback);
  callback(getOutboxCount());
  return () => listeners.delete(callback);
}

export function enqueueOfflineOrder(payload) {
  const queue = readQueue();
  const clientOrderId = payload.clientOrderId || `OFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entry = {
    clientOrderId,
    queuedAt: new Date().toISOString(),
    payload: { ...payload, clientOrderId }
  };
  queue.push(entry);
  writeQueue(queue);
  return {
    id: clientOrderId,
    orderId: clientOrderId,
    orderNumber: clientOrderId,
    offlineQueued: true,
    items: payload.items || [],
    orderType: payload.orderType || 1,
    tableId: payload.tableId || null
  };
}

export async function flushOrderOutbox() {
  if (isFlushing) return { flushed: 0, remaining: getOutboxCount() };
  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  isFlushing = true;
  const remaining = [];
  let flushed = 0;

  try {
    for (const item of queue) {
      try {
        await requestJson('/api/orders', {
          method: 'POST',
          body: item.payload,
          defaultError: 'Error sincronizando orden offline'
        });
        flushed += 1;
      } catch (err) {
        // Si sigue siendo fallo de red (sin status HTTP), conservar en la cola
        if (!err.status) {
          remaining.push(item);
        } else {
          console.warn('[OrderOutbox] Orden descartada por rechazo de validación:', err.message);
        }
      }
    }
    writeQueue(remaining);
  } finally {
    isFlushing = false;
  }

  return { flushed, remaining: remaining.length };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOrderOutbox().catch(() => {});
  });
}
