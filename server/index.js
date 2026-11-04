const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const aldeloService = require('./aldeloService');
const receiptService = require('./receiptService');
const WhatsAppService = require('./whatsappService');

const whatsappService = new WhatsAppService(() => {
  try {
    delete require.cache[require.resolve('../config.json')];
    return require('../config.json');
  } catch (_) {
    return {};
  }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Desactivar caché HTTP para toda la API REST para garantizar datos 100% en tiempo real al recargar
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Ping legacy endpoint for connectivity discovery
app.all('/ping', (req, res) => {
  const key = (req.body && req.body.key) || req.query.key || req.ip || '127.0.0.1';
  res.json({ code: 0, responseip: key });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// --- API ROUTES ---

// 1. Obtener menú completo con categorías
app.get('/api/menu', async (req, res) => {
  try {
    const categories = await aldeloService.getMenu();
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('Error in /api/menu:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Obtener lista de empleados / cajeros
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await aldeloService.getEmployees();
    res.json({ success: true, data: employees });
  } catch (err) {
    console.error('Error in /api/employees:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2b. Obtener mesas disponibles
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await aldeloService.getTables();
    res.json({ success: true, data: tables });
  } catch (err) {
    console.error('Error in /api/tables:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Obtener órdenes activas (para KDS y pantalla de turnos)
app.get('/api/orders/active', async (req, res) => {
  try {
    const orders = await aldeloService.getActiveOrders();
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('Error in /api/orders/active:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Crear orden (desde Kiosk o Front Desk)
app.post('/api/orders', async (req, res) => {
  try {
    const { employeeId, items, paymentMethod, notes, tableId, guestNumber, orderType, isPaid } = req.body;
    
    // Guardar en base de datos Aldelo
    const newOrder = await aldeloService.createOrder({
      employeeId: employeeId || 1,
      orderType: orderType || 1,
      items,
      paymentMethod: paymentMethod || 'CASH',
      notes,
      tableId,
      guestNumber,
      isPaid: (isPaid !== undefined) ? !!isPaid : true
    });

    // Traer la orden completa con sus items para emitirla al KDS
    const activeOrders = await aldeloService.getActiveOrders();
    const fullOrder = activeOrders.find(o => o.id === newOrder.orderId) || newOrder;

    // Emitir en tiempo real a todas las pantallas conectadas (KDS, Turnos, Caja)
    io.emit('order:new', fullOrder);
    console.log(`[Order Created] Order #${newOrder.orderId} emitted via Socket.io`);

    res.status(201).json({ success: true, data: fullOrder });
  } catch (err) {
    console.error('Error in POST /api/orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Actualizar estado de orden según especificación Aldelo POS:
// 1 = OpenOrder (Orden abierta)
// 2 = SettledOrder (Orden pagada y cerrada)
// 3 = VoidedOrder (Orden anulada)
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status, tableReady, paymentMethod, employeeId } = req.body;

    const result = await aldeloService.updateOrderStatus(orderId, status, tableReady, paymentMethod, employeeId);

    // Si la orden se pagó ('2'), pasa a PREPARING en cocina inmediatamente
    if (status === '2') {
      io.emit('kds:status_changed', { orderId, kdsStatus: 'PREPARING', tableReady: false });
    }

    // Emitir cambio de estado a KDS y pantalla de turnos
    io.emit('order:status_changed', { orderId, status, tableReady, isPaid: status === '2' });
    console.log(`[Order Status] Order #${orderId} changed to ${status} (isPaid: ${status === '2'})`);

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error in PUT /api/orders/:id/status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Estado operativo exclusivo de COCINA (KDS):
// PENDING, COOKING, READY, SERVED
// NO altera OrderStatus de Aldelo.
app.put('/api/orders/:id/kds-status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { kdsStatus, itemChecks } = req.body;

    const result = await aldeloService.updateKdsStatus(orderId, kdsStatus, itemChecks);

    io.emit('kds:status_changed', { 
      orderId, 
      kdsStatus: result.kdsStatus, 
      itemChecks: result.itemChecks,
      tableReady: result.kdsStatus === 'READY'
    });
    console.log(`[KDS Status] Order #${orderId} changed to ${result.kdsStatus}`);

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error in PUT /api/orders/:id/kds-status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Wompi Payments Integration (Colombia COP)
app.post('/api/payments/wompi/intent', (req, res) => {
  try {
    const { amount, reference: customRef } = req.body;
    const aldeloAmount = parseFloat(amount) || 0;
    const amountInCOP = Math.round(aldeloAmount * 1000);
    const amountInCents = amountInCOP * 100;
    const reference = customRef || `SP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let appConfig = {};
    try { appConfig = require('../config.json'); } catch (e) {}
    const wompiConfig = appConfig.wompi || {};
    const publicKey = wompiConfig.publicKey || 'pub_prod_F4z65GfEwT9z3P';
    const integritySecret = wompiConfig.integritySecret || '';
    const currency = wompiConfig.currency || 'COP';

    let signature = '';
    if (integritySecret) {
      const crypto = require('crypto');
      const rawSignature = `${reference}${amountInCents}${currency}${integritySecret}`;
      signature = crypto.createHash('sha256').update(rawSignature).digest('hex');
    }

    let checkoutUrl = `https://checkout.wompi.co/p/?public-key=${publicKey}&currency=${currency}&amount-in-cents=${amountInCents}&reference=${reference}`;
    if (signature) {
      checkoutUrl += `&signature:integrity=${signature}`;
    }

    res.json({
      success: true,
      data: {
        reference,
        amountInCOP,
        amountInCents,
        currency,
        publicKey,
        signature,
        checkoutUrl
      }
    });
  } catch (err) {
    console.error('Error generating Wompi intent:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6b. Webhook / Simulación de pago Wompi QR
app.post('/api/payments/wompi/webhook', (req, res) => {
  try {
    const event = req.body;
    console.log('[Wompi Webhook received]:', event);
    // Si la transacción está aprobada, se emite el evento al frontend del Kiosk
    if (event && event.data && event.data.transaction) {
      const tx = event.data.transaction;
      io.emit(`payment:${tx.reference}`, {
        status: tx.status,
        amount: tx.amount_in_cents / 100,
        reference: tx.reference
      });
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Enviar o consultar Recibo Digital (Email / SMS / WhatsApp / Web)
app.post('/api/orders/:id/receipt', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { type, destination } = req.body;
    
    // Obtener datos de la orden o generar nuevo código
    const receiptInfo = receiptService.generateReceiptCode(orderId);
    console.log(`[Receipt] Recibo digital solicitado para Orden #${orderId}: tipo=${type}, destino=${destination}, url=${receiptInfo.path}`);
    
    let sendResult = null;
    if (type === 'whatsapp' && destination) {
      const config = whatsappService.getConfig();
      const restaurantName = config.restaurant?.name || 'Serviplus';
      const body = `¡Hola! 👋 Aquí tienes el comprobante de tu pedido #${orderId} en ${restaurantName}:\n\n🔗 ${receiptInfo.fullUrl}\n\n¡Gracias por tu compra!`;
      sendResult = await whatsappService.sendMessage(destination, body);
    }

    res.json({
      success: true,
      data: {
        orderId,
        receiptCode: receiptInfo.urlCode,
        receiptUrl: receiptInfo.path,
        transactionRef: receiptInfo.transactionRef,
        receiptFullUrl: receiptInfo.fullUrl,
        sendResult
      },
      message: `Recibo digital procesado con éxito para ${destination}`
    });
  } catch (err) {
    console.error('Error in POST /api/orders/:id/receipt:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7a. Enviar Mensaje de WhatsApp directo (Meta Graph API Cloud v25.0)
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, body, orderNumber, receiptUrl } = req.body;
    let messageBody = body;
    if (!messageBody && receiptUrl) {
      const config = whatsappService.getConfig();
      const restaurantName = config.restaurant?.name || 'Serviplus';
      messageBody = `¡Hola! 👋 Aquí tienes el comprobante de tu pedido #${orderNumber || ''} en ${restaurantName}:\n\n🔗 ${receiptUrl}\n\n¡Gracias por tu compra!`;
    }

    const result = await whatsappService.sendMessage(to, messageBody);
    res.json(result);
  } catch (err) {
    console.error('Error in POST /api/whatsapp/send:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b. API para consultar JSON de un Recibo por su código único de 13 caracteres
app.get('/api/receipts/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const verified = receiptService.verifyReceiptCode(code);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Código de recibo inválido o expirado' });
    }

    const orderData = await aldeloService.getOrderReceiptData(verified.orderId);
    if (!orderData) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    res.json({
      success: true,
      data: {
        ...orderData,
        transactionRef: verified.transactionRef || `SP-${verified.txId}`,
        receiptCode: code
      }
    });
  } catch (err) {
    console.error('Error in GET /api/receipts/:code:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7c. Renderizar vista HTML pública del Recibo Digital (estilo móvil upaysolutions.app)
app.get(['/p/:code', '/p/p/:code', '/receipt/:code', '/r/:code'], async (req, res) => {
  try {
    const { code } = req.params;
    const verified = receiptService.verifyReceiptCode(code);
    
    if (!verified) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Recibo No Encontrado • Serviplus</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#eaedf0] min-h-screen flex items-center justify-center p-4 font-sans">
          <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div class="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">✕</div>
            <h1 class="text-lg font-extrabold text-gray-900">Recibo No Encontrado</h1>
            <p class="text-sm text-gray-500 mt-2">El código de recibo digital es inválido o no existe en el sistema.</p>
            <p class="text-xs font-mono text-gray-400 mt-1">${code || ''}</p>
            <a href="/" class="mt-5 inline-block w-full py-2.5 px-4 bg-[#191c1e] hover:bg-black text-white font-bold rounded-xl text-sm transition">
              Ir al Inicio
            </a>
          </div>
        </body>
        </html>
      `);
    }

    const orderData = await aldeloService.getOrderReceiptData(verified.orderId);
    if (!orderData) {
      return res.status(404).send('La orden asociada a este recibo no se encuentra disponible.');
    }

    const html = receiptService.renderReceiptHtml({
      ...orderData,
      transactionRef: verified.transactionRef || `SP-${verified.txId}`
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering digital receipt:', err);
    res.status(500).send('Error al procesar el recibo digital.');
  }
});

// 1. Ruta principal / : Cargar directamente la aplicación clásica
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Redirigir cualquier enlace antiguo de /old hacia la ruta raíz /#/mesas
app.get(['/old', '/old/*'], (req, res) => {
  res.redirect('/#/mesas');
});

// 2. Ruta modern: Aplicación alternativa Kiosk & KDS (Vanilla)
app.get(['/modern', '/modern/*'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/modern/index.html'));
});

// 3. Ruta react: Nueva aplicación React Kiosk & KDS (Single Page App)
app.use('/react', express.static(path.join(__dirname, '../client/dist')));
app.get(['/react', '/react/*'], (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// 4. Ruta directa para Kiosk Autoservicio en Pantalla Completa
app.get(['/kiosk', '/autoservice', '/kiosk-fs', '/kiosk-fullscreen'], (req, res) => {
  res.redirect('/react/?tab=kiosk&fullscreen=true');
});

// Redirigir al visor clásico
app.get('/visor', (req, res) => {
  res.redirect('/#/visor');
});

// Servir archivos estáticos (css, js, imágenes)
const clientDist = path.join(__dirname, '../public');
app.use(express.static(clientDist));

const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Modern Kiosk & KDS Gateway Server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`📦 Productos DB: ${aldeloService.getProductsSource ? aldeloService.getProductsSource() : 'C:\\SP\\B\\k.mdb'}`);
  console.log(`====================================================`);
});

