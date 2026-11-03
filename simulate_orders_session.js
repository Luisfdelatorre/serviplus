/**
 * ============================================================================
 * SESIÓN DE PRUEBAS DE ÓRDENES Y CULMINACIÓN EN KDS
 * ============================================================================
 * 
 * Genera automáticamente órdenes de prueba hacia el servidor cada minuto (o
 * intervalo configurado) y programa su culminación aleatoria en cocina (KDS)
 * entre 10 y 15 minutos (READY -> SERVED).
 * 
 * Uso:
 *   node simulate_orders_session.js                 # Tiempo real: 1 orden/min, KDS 10-15 min
 *   node simulate_orders_session.js --speed 10      # Modo acelerado (10x más rápido para pruebas)
 *   node simulate_orders_session.js --interval 30   # Cada 30 segundos
 *   node simulate_orders_session.js --count 5       # Generar solo 5 órdenes
 * ============================================================================
 */

const http = require('http');

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) {
    const val = Number(args[idx + 1]);
    return isNaN(val) ? args[idx + 1] : val;
  }
  return defaultValue;
}

const CONFIG = {
  host: getArg('--host', 'localhost'),
  port: getArg('--port', 80),
  // Intervalo de creación de órdenes en segundos (default: 60s = 1 minuto)
  intervalSec: getArg('--interval', 60),
  // Rango de culminación en KDS en minutos (default: entre 10 y 15 minutos)
  minPrepMin: getArg('--min-prep', 10),
  maxPrepMin: getArg('--max-prep', 15),
  // Acelerador de tiempo (1 = tiempo real, 10 = 10x más rápido)
  speed: Math.max(0.1, Number(getArg('--speed', 1)) || 1),
  // Cantidad máxima de órdenes a generar (0 o null = ilimitado)
  maxOrders: getArg('--count', 0),
  // Si se debe despachar a SERVED después de estar lista (default: false, se quedan en LISTAS)
  autoServe: args.includes('--auto-serve')
};

// Tiempos reales ajustados por el factor de velocidad
const INTERVAL_MS = (CONFIG.intervalSec * 1000) / CONFIG.speed;
const MIN_PREP_MS = (CONFIG.minPrepMin * 60 * 1000) / CONFIG.speed;
const MAX_PREP_MS = (CONFIG.maxPrepMin * 60 * 1000) / CONFIG.speed;

// Estadísticas de la sesión
const stats = {
  startedAt: new Date(),
  totalCreated: 0,
  inPreparation: 0,
  ready: 0,
  served: 0,
  failed: 0,
  activeTimers: new Set()
};

// Notas típicas de cocina para simular pedidos realistas
const SAMPLE_NOTES = [
  'Sin cebolla',
  'Bien tostado',
  'Salsa aparte',
  'Poco picante',
  'Sin vegetales',
  'Bien cocido',
  'Extra servilletas',
  ''
];

// Helper para llamadas HTTP tipo Promise
function httpRequest({ path, method = 'GET', data = null }) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: CONFIG.host,
        port: CONFIG.port,
        path,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          : {}
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || parsed.message || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(body);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 100)}`));
            }
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

// Formatear timestamp HH:MM:SS
function getTimestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

// Formatear duración en mm:ss
function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec < 10 ? '0' : ''}${sec}s`;
}

// Catálogo en memoria que se alimenta del servidor
let cachedCatalog = [];
let cachedTables = [];

async function loadServerData() {
  console.log(`[${getTimestamp()}] 📡 Conectando a http://${CONFIG.host}:${CONFIG.port}...`);
  try {
    const menuRes = await httpRequest({ path: '/api/menu' });
    const categories = menuRes.data || [];
    cachedCatalog = categories.flatMap((c) =>
      (c.items || []).map((it) => ({
        ...it,
        categoryName: c.name
      }))
    );
    console.log(`[${getTimestamp()}] ✅ Menú cargado: ${cachedCatalog.length} productos disponibles.`);
  } catch (err) {
    console.warn(`[${getTimestamp()}] ⚠️ No se pudo obtener /api/menu (${err.message}). Usando catálogo base de respaldo.`);
    cachedCatalog = [
      { id: 623, name: 'Kebab pollo', price: 8, modifiers: [{ id: 220, name: 'Extra queso', price: 1 }] },
      { id: 624, name: 'Kebab carne', price: 8, modifiers: [{ id: 221, name: 'Extra tocineta', price: 1 }] },
      { id: 625, name: 'Kebab mixto', price: 9, modifiers: [] },
      { id: 626, name: 'Shawarma mixto', price: 9, modifiers: [] }
    ];
  }

  try {
    const tablesRes = await httpRequest({ path: '/api/tables' });
    cachedTables = (tablesRes.data || []).map((t) => t.name || t.id);
    console.log(`[${getTimestamp()}] ✅ Mesas cargadas: ${cachedTables.length} mesas.`);
  } catch (err) {
    cachedTables = ['1', '2', '3', '4', '5', '6', '7', '8'];
  }
}

// Construir una orden aleatoria realista
function generateRandomOrderPayload() {
  if (cachedCatalog.length === 0) return null;

  // 1 a 3 ítems por orden
  const itemCount = Math.floor(Math.random() * 3) + 1;
  const items = [];

  for (let i = 0; i < itemCount; i++) {
    const randomProduct = cachedCatalog[Math.floor(Math.random() * cachedCatalog.length)];
    const qty = Math.random() < 0.8 ? 1 : 2;
    const selectedMods = [];

    // 40% de probabilidad de incluir un modificador si el producto tiene
    if (randomProduct.modifiers && randomProduct.modifiers.length > 0 && Math.random() < 0.4) {
      const randomMod = randomProduct.modifiers[Math.floor(Math.random() * randomProduct.modifiers.length)];
      selectedMods.push({
        id: randomMod.id,
        name: randomMod.name,
        price: randomMod.price || 0
      });
    }

    const randomNote = Math.random() < 0.35 ? SAMPLE_NOTES[Math.floor(Math.random() * SAMPLE_NOTES.length)] : '';

    items.push({
      id: randomProduct.id,
      name: randomProduct.name,
      quantity: qty,
      price: randomProduct.price,
      basePrice: randomProduct.price,
      modifiers: selectedMods,
      notes: randomNote
    });
  }

  // 50% Comer en mesa, 50% Para llevar
  const isDineIn = Math.random() < 0.5;
  const tableId = isDineIn && cachedTables.length > 0 ? cachedTables[Math.floor(Math.random() * cachedTables.length)] : null;

  return {
    employeeId: 1,
    orderType: isDineIn ? 1 : 2,
    tableId: isDineIn ? tableId : null,
    paymentMethod: Math.random() < 0.5 ? 'WOMPI_QR' : 'CARD',
    isPaid: true,
    items
  };
}

// Programar la culminación en KDS de una orden creada
function scheduleKdsCompletion(orderId, orderNumber, prepTimeMs, simulatedMin) {
  stats.inPreparation++;

  // Al cumplir el tiempo aleatorio (10 a 15 min), pasa a estado READY (Listo para entrega)
  const readyDelayMs = prepTimeMs;

  const readyTimer = setTimeout(async () => {
    try {
      await httpRequest({
        path: `/api/orders/${orderId}/kds-status`,
        method: 'PUT',
        data: { kdsStatus: 'READY' }
      });
      stats.inPreparation = Math.max(0, stats.inPreparation - 1);
      stats.ready++;
      console.log(
        `[${getTimestamp()}] 🔔 [KDS LISTO] Orden #${orderNumber} (ID: ${orderId}) culminó preparación (${simulatedMin.toFixed(1)} min) -> LISTA en KDS.`
      );

      // Si se configuró auto-despacho, despachar después de 2 minutos
      if (CONFIG.autoServe) {
        const autoServeDelayMs = (2 * 60 * 1000) / CONFIG.speed;
        const servedTimer = setTimeout(async () => {
          try {
            await httpRequest({
              path: `/api/orders/${orderId}/kds-status`,
              method: 'PUT',
              data: { kdsStatus: 'SERVED' }
            });
            stats.ready = Math.max(0, stats.ready - 1);
            stats.served++;
            console.log(
              `[${getTimestamp()}] ✅ [KDS SERVIDA] Orden #${orderNumber} (ID: ${orderId}) despachada de cocina.`
            );
          } catch (e) {}
        }, autoServeDelayMs);
        stats.activeTimers.add(servedTimer);
      }
    } catch (err) {
      console.error(`[${getTimestamp()}] ⚠️ Error marcando orden #${orderNumber} como READY:`, err.message);
    } finally {
      stats.activeTimers.delete(readyTimer);
    }
  }, readyDelayMs);

  stats.activeTimers.add(readyTimer);
}

// Emitir una nueva orden
async function emitNewOrder() {
  const payload = generateRandomOrderPayload();
  if (!payload) return;

  try {
    const res = await httpRequest({
      path: '/api/orders',
      method: 'POST',
      data: payload
    });

    const orderData = res.data || res;
    const orderId = orderData.orderId || orderData.id;
    const orderNumber = orderData.orderNumber || orderId % 100;
    stats.totalCreated++;

    // Tiempo aleatorio entre minPrep y maxPrep (ej. 10 y 15 min)
    const randomFraction = Math.random();
    const simulatedPrepMin = CONFIG.minPrepMin + randomFraction * (CONFIG.maxPrepMin - CONFIG.minPrepMin);
    const simulatedPrepMs = (simulatedPrepMin * 60 * 1000) / CONFIG.speed;

    const itemsSummary = payload.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const typeSummary = payload.orderType === 1 ? `Mesa ${payload.tableId || 1}` : 'Para llevar';

    console.log(
      `[${getTimestamp()}] 🟢 [ORDEN NUEVA #${orderNumber}] ID: ${orderId} | ${typeSummary} | (${itemsSummary})`
    );
    console.log(
      `   ⏳ KDS: Programada para culminar en ${simulatedPrepMin.toFixed(1)} min (en reloj real: ${formatDuration(simulatedPrepMs)})`
    );

    // Programar transición automática en KDS
    scheduleKdsCompletion(orderId, orderNumber, simulatedPrepMs, simulatedPrepMin);
  } catch (err) {
    stats.failed++;
    console.error(`[${getTimestamp()}] ❌ Error creando orden:`, err.message);
  }
}

// Imprimir estado de la sesión
function printStatusSummary() {
  const elapsedSec = Math.round((new Date() - stats.startedAt) / 1000);
  console.log('--------------------------------------------------------------------------------');
  console.log(
    `📊 [RESUMEN SESIÓN] Tiempo activo: ${formatDuration(elapsedSec * 1000)} | Creadas: ${stats.totalCreated} | En Cocina: ${stats.inPreparation} | Listas: ${stats.ready} | Culminadas: ${stats.served}`
  );
  console.log('--------------------------------------------------------------------------------');
}

// Manejo de salida limpia (Ctrl + C)
function handleExit() {
  console.log('\n\n================================================================================');
  console.log('🛑 DETENIENDO SESIÓN DE PRUEBAS');
  printStatusSummary();
  console.log(`⏱️ Órdenes activas en espera en KDS: ${stats.activeTimers.size / 2}`);
  console.log('👋 Sesión finalizada.');
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// Función principal
async function runSession() {
  console.clear();
  console.log('================================================================================');
  console.log('🚀 SERVIPLUS - SESIÓN DE PRUEBAS CONTINUAS DE ÓRDENES Y KDS');
  console.log('================================================================================');
  console.log(`⏱️  Frecuencia de órdenes: Cada ${CONFIG.intervalSec} seg (${formatDuration(INTERVAL_MS)} en ejecución)`);
  console.log(`🍳 Rango de culminación en KDS: Entre ${CONFIG.minPrepMin} y ${CONFIG.maxPrepMin} minutos`);
  if (CONFIG.speed !== 1) {
    console.log(`⚡ Acelerador de velocidad: ${CONFIG.speed}x (Tiempo acelerado)`);
  } else {
    console.log(`⏳ Modo: Tiempo real (1 minuto exacto entre órdenes)`);
  }
  if (CONFIG.maxOrders > 0) {
    console.log(`🎯 Límite de órdenes: ${CONFIG.maxOrders}`);
  } else {
    console.log(`♾️  Modo continuo: Presiona Ctrl+C en cualquier momento para detener.`);
  }
  console.log('================================================================================\n');

  await loadServerData();

  console.log(`\n[${getTimestamp()}] 🎬 Iniciando emisión de órdenes...\n`);

  // Emitir la primera orden inmediatamente
  await emitNewOrder();

  let ordersEmitted = 1;

  // Programar la emisión cada minuto (INTERVAL_MS)
  const orderInterval = setInterval(async () => {
    if (CONFIG.maxOrders > 0 && ordersEmitted >= CONFIG.maxOrders) {
      clearInterval(orderInterval);
      console.log(`\n[${getTimestamp()}] 🏁 Se alcanzó el límite configurado de ${CONFIG.maxOrders} órdenes.`);
      console.log(`   Esperando a que las órdenes en curso culminen en KDS... (Presiona Ctrl+C para salir)`);
      return;
    }

    await emitNewOrder();
    ordersEmitted++;

    // Imprimir resumen cada 3 órdenes
    if (ordersEmitted % 3 === 0) {
      printStatusSummary();
    }
  }, INTERVAL_MS);
}

runSession();

