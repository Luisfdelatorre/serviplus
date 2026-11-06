/**
 * Serviplus Hybrid Bridge - Agente de Sincronización Local (Windows -> Linode)
 * Conecta kebab.mdb (Aldelo 2004) en la máquina Windows con el servidor Cloud (serviplus.upaysolutions.app)
 */

const { io } = require('socket.io-client');
const aldeloService = require('./aldeloService');
const receiptService = require('./receiptService');
const fs = require('fs');
const path = require('path');

class CloudBridgeClient {
  constructor(configGetter) {
    this.getConfig = typeof configGetter === 'function' ? configGetter : () => (configGetter || {});
    this.socket = null;
    this.isConnected = false;
    this.isSyncingMenu = false;
    this.mdbWatcherDebounceTimer = null;
    this.watchedMdbPath = null;
  }

  start() {
    const config = this.getConfig() || {};
    const cloud = config.cloud || {};

    const serverUrl = cloud.baseUrl || 'https://serviplus.upaysolutions.app';
    const storeId = cloud.storeId || 'store_principal';
    const secretKey = cloud.secretKey || 'serviplus_hybrid_secret_v1';

    console.log(`[Cloud Bridge] Conectando a Linode Cloud (${serverUrl}) para tienda: ${storeId}...`);

    this.socket = io(serverUrl, {
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
      auth: {
        storeId,
        secretKey,
        clientType: 'aldelo_windows_agent'
      }
    });

    this.setupListeners(storeId);
    this.startMdbWatcher(config);
  }

  /**
   * Vigilante de kebab.mdb: detecta cambios de precios/menú realizados en Aldelo POS
   */
  startMdbWatcher(config) {
    try {
      const connStr = config?.db?.connectionString || '';
      const match = connStr.match(/Data Source=([^;]+)/i);
      const mdbPath = (match && match[1]) ? match[1].trim() : 'C:\\SP\\B\\kebab.mdb';

      if (fs.existsSync(mdbPath)) {
        this.watchedMdbPath = mdbPath;
        console.log(`[Cloud Bridge] 👁️ Vigilando cambios en Aldelo MDB: ${mdbPath}`);

        fs.watchFile(mdbPath, { interval: 2000 }, (curr, prev) => {
          if (curr.mtime.getTime() !== prev.mtime.getTime()) {
            console.log(`[Cloud Bridge] 🔔 Aldelo MDB modificado. Preparando resincronización automática...`);
            clearTimeout(this.mdbWatcherDebounceTimer);
            // Debounce de 3 segundos para que Aldelo termine de escribir sus transacciones
            this.mdbWatcherDebounceTimer = setTimeout(async () => {
              if (this.isConnected) {
                console.log(`[Cloud Bridge] ⚡ Disparando actualización de catálogo hacia la nube...`);
                await this.syncMenuToCloud();
              }
            }, 3000);
          }
        });
      } else {
        console.warn(`[Cloud Bridge] Archivo MDB no encontrado para vigilar en: ${mdbPath}`);
      }
    } catch (err) {
      console.error('[Cloud Bridge] Error iniciando vigilante de MDB:', err.message);
    }
  }

  setupListeners(storeId) {
    this.socket.on('connect', async () => {
      this.isConnected = true;
      console.log(`[Cloud Bridge] ✅ Conectado exitosamente con Linode Cloud (ID: ${this.socket.id})`);

      // Registrarse formalmente en la sala de la tienda
      this.socket.emit('store:register', {
        storeId,
        agentName: 'Serviplus Windows Aldelo Bridge',
        system: 'Aldelo 2004 MDB',
        timestamp: new Date().toISOString()
      });

      // Sincronizar catálogo inicial a la nube
      await this.syncMenuToCloud();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.warn(`[Cloud Bridge] ⚠️ Desconectado de Linode Cloud (${reason}). Reintentando conexión automática...`);
    });

    this.socket.on('connect_error', (err) => {
      console.error(`[Cloud Bridge] ❌ Error de enlace con Linode Cloud:`, err.message);
    });

    // Petición manual o remota de sincronización de catálogo
    this.socket.on('menu:request_sync', async (data) => {
      console.log('[Cloud Bridge] Petición de resincronización de catálogo recibida desde Linode:', data);
      await this.syncMenuToCloud();
    });

    // Evento: Pedido pagado confirmado en Linode (ej. por Wompi Webhook o Kiosk)
    this.socket.on('order:paid', async (cloudOrder) => {
      console.log(`[Cloud Bridge] 📥 Pedido pagado recibido de la nube (${cloudOrder.cloudOrderId || cloudOrder.id}). Inyectando en Aldelo kebab.mdb...`);
      await this.handlePaidOrder(cloudOrder);
    });
  }

  /**
   * Lee el menú actual desde kebab.mdb y lo envía a Linode para alimentar el Kiosk web
   */
  async syncMenuToCloud() {
    if (this.isSyncingMenu) return;
    this.isSyncingMenu = true;

    try {
      console.log('[Cloud Bridge] Consultando menú en Aldelo kebab.mdb...');
      const menu = await aldeloService.getMenu();
      const count = Array.isArray(menu) ? menu.length : 0;
      console.log(`[Cloud Bridge] Menú leído con éxito (${count} productos). Sincronizando con Linode...`);

      this.socket.emit('menu:sync_data', {
        menu,
        syncedAt: new Date().toISOString(),
        productCount: count
      });
      console.log('[Cloud Bridge] ✅ Catálogo sincronizado en Linode Cloud.');
    } catch (err) {
      console.error('[Cloud Bridge] ❌ Error al sincronizar menú con Linode:', err.message);
    } finally {
      this.isSyncingMenu = false;
    }
  }

  /**
   * Inyecta una orden pagada físicamente en la base de datos de Aldelo
   */
  async handlePaidOrder(cloudOrder) {
    try {
      const items = cloudOrder.items || [];
      const paymentMethod = cloudOrder.paymentMethod || 'WOMPI_QR';
      const transactionRef = cloudOrder.transactionRef || `CL-${Date.now()}`;
      const notes = cloudOrder.notes || `Kiosk Web - ${cloudOrder.customerName || 'Cliente'}`;

      // 1. Inyectar en kebab.mdb mediante aldeloService
      const aldeloResult = await aldeloService.createOrder({
        employeeId: 1,
        orderType: cloudOrder.orderType || 1, // 1 = Dine-In, 2 = To-Go, etc.
        items: items.map(item => ({
          menuItemId: item.id || item.menuItemId,
          quantity: item.quantity || 1,
          price: item.price,
          name: item.name,
          notes: item.notes || ''
        })),
        notes,
        paymentMethod,
        isPaid: true,
        transactionRef,
        wompiTransactionId: cloudOrder.wompiTransactionId || ''
      });

      const orderId = aldeloResult.orderId;
      console.log(`[Cloud Bridge] ✅ Pedido inyectado exitosamente en Aldelo con OrderID: #${orderId}`);

      // 2. Generar recibo digital oficial
      const receiptInfo = receiptService.generateReceiptCode(orderId, new Date(), {
        customerName: cloudOrder.customerName,
        phone: cloudOrder.phone,
        total: cloudOrder.total
      });

      // 3. Confirmar a Linode con el número de orden de Aldelo y el enlace de recibo
      this.socket.emit('order:aldelo_confirmed', {
        cloudOrderId: cloudOrder.cloudOrderId || cloudOrder.id,
        aldeloOrderId: orderId,
        receiptCode: receiptInfo.urlCode,
        receiptUrl: receiptInfo.fullUrl,
        confirmedAt: new Date().toISOString()
      });

      console.log(`[Cloud Bridge] Confirmación emitida a la nube. Recibo: ${receiptInfo.fullUrl}`);
    } catch (err) {
      console.error(`[Cloud Bridge] ❌ Falló la inyección del pedido en Aldelo:`, err.message);
      this.socket.emit('order:aldelo_failed', {
        cloudOrderId: cloudOrder.cloudOrderId || cloudOrder.id,
        error: err.message,
        failedAt: new Date().toISOString()
      });
    }
  }

  stop() {
    if (this.mdbWatcherDebounceTimer) {
      clearTimeout(this.mdbWatcherDebounceTimer);
      this.mdbWatcherDebounceTimer = null;
    }
    if (this.watchedMdbPath) {
      fs.unwatchFile(this.watchedMdbPath);
      this.watchedMdbPath = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('[Cloud Bridge] Agente detenido.');
    }
  }
}

// Permitir ejecución directa con: node server/cloudBridgeClient.js
if (require.main === module) {
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
  } catch (e) {
    console.error('Error leyendo config.json:', e.message);
  }

  const agent = new CloudBridgeClient(() => config);
  agent.start();

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });
}

module.exports = CloudBridgeClient;
