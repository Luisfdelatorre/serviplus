/**
 * Serviplus Cloud Gateway - Módulo de Servidor para Linode (serviplus.upaysolutions.app)
 * Montar en el servidor Node.js/Express de Linode con Socket.IO
 */

const { Server } = require('socket.io');

function initCloudBridgeServer(httpServer, options = {}) {
  const secretKey = options.secretKey || process.env.CLOUD_SECRET_KEY || 'serviplus_hybrid_secret_v1';

  // Memoria en la nube para sincronización en tiempo real
  const storeData = {
    menu: [],
    categories: [],
    lastMenuSync: null,
    connectedAgents: {},
    pendingOrders: {},
    activeOrders: {}
  };

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    path: '/socket.io'
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    // Los agentes Windows deben enviar la secretKey
    if (auth.clientType === 'aldelo_windows_agent') {
      if (auth.secretKey !== secretKey) {
        return next(new Error('Autenticación inválida de agente Windows'));
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const auth = socket.handshake.auth || {};

    // 1. Conexión del Agente Local Windows (Aldelo MDB)
    if (auth.clientType === 'aldelo_windows_agent') {
      const storeId = auth.storeId || 'store_principal';
      socket.join(`store:${storeId}`);
      storeData.connectedAgents[socket.id] = { storeId, connectedAt: new Date() };
      console.log(`[Cloud Linode] 🖥️ Agente Windows Aldelo conectado para tienda "${storeId}" (Socket: ${socket.id})`);

      // Recibir menú sincronizado desde kebab.mdb
      socket.on('menu:sync_data', (payload) => {
        storeData.menu = payload.menu || [];
        storeData.lastMenuSync = payload.syncedAt || new Date().toISOString();
        console.log(`[Cloud Linode] 📋 Menú actualizado desde Aldelo (${payload.productCount || storeData.menu.length} productos)`);
        // Notificar a todos los Kiosks y pantallas web que el menú se actualizó
        io.emit('kiosk:menu_updated', {
          menu: storeData.menu,
          syncedAt: storeData.lastMenuSync
        });
      });

      // Confirmación de pedido inyectado en Aldelo
      socket.on('order:aldelo_confirmed', (confirmation) => {
        const { cloudOrderId, aldeloOrderId, receiptCode, receiptUrl } = confirmation;
        console.log(`[Cloud Linode] ✅ Pedido #${aldeloOrderId} inyectado en Aldelo para orden ${cloudOrderId}`);

        if (storeData.activeOrders[cloudOrderId]) {
          storeData.activeOrders[cloudOrderId].status = 'IN_ALDELO';
          storeData.activeOrders[cloudOrderId].aldeloOrderId = aldeloOrderId;
          storeData.activeOrders[cloudOrderId].receiptUrl = receiptUrl;
        }

        // Notificar al Kiosk y al KDS en tiempo real
        io.emit(`order:confirmed:${cloudOrderId}`, confirmation);
        io.emit('kitchen:new_order', {
          orderId: aldeloOrderId,
          cloudOrderId,
          receiptCode,
          receiptUrl,
          order: storeData.activeOrders[cloudOrderId]
        });
      });

      socket.on('disconnect', () => {
        delete storeData.connectedAgents[socket.id];
        console.log(`[Cloud Linode] ⚠️ Agente Windows Aldelo desconectado (Socket: ${socket.id})`);
      });
    }

    // 2. Conexión de Kiosks web o KDS
    socket.on('kiosk:request_menu', () => {
      socket.emit('kiosk:menu_data', {
        menu: storeData.menu,
        syncedAt: storeData.lastMenuSync
      });
    });
  });

  return {
    io,
    storeData,

    /**
     * Devuelve el menú actual en caché para endpoints HTTP GET /api/menu
     */
    getMenu() {
      return {
        menu: storeData.menu,
        lastSync: storeData.lastMenuSync,
        hasLocalAgent: Object.keys(storeData.connectedAgents).length > 0
      };
    },

    /**
     * Dispara la inyección de una orden pagada hacia el agente Windows
     */
    dispatchPaidOrder(orderData, storeId = 'store_principal') {
      const cloudOrderId = orderData.cloudOrderId || `ORD-${Date.now()}`;
      storeData.activeOrders[cloudOrderId] = {
        ...orderData,
        cloudOrderId,
        status: 'PAID_PENDING_ALDELO',
        receivedAt: new Date().toISOString()
      };

      console.log(`[Cloud Linode] Despachando orden pagada ${cloudOrderId} hacia Windows (${storeId})...`);
      io.to(`store:${storeId}`).emit('order:paid', storeData.activeOrders[cloudOrderId]);
      return cloudOrderId;
    }
  };
}

module.exports = initCloudBridgeServer;
