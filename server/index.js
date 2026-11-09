const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const configStore = require('./config');
const aldeloService = require('./aldeloService');
const receiptService = require('./receiptService');
const WompiService = require('./wompiService');
const SmsService = require('./smsService');
const WhatsAppService = require('./whatsappService');
const paymentStore = require('./paymentStore');
const CloudBridgeClient = require('./cloudBridgeClient');
const cashShiftService = require('./cashShiftService');
const printerService = require('./printerService');
const auditService = require('./auditService');
const { createCashShiftRoutes } = require('./routes/cashShiftRoutes');
const { createAdminRoutes } = require('./routes/adminRoutes');
const { createLicenseRoutes } = require('./routes/licenseRoutes');
const { createLicenseGate } = require('./middleware/licenseGate');
const { createLicenseService } = require('./license/licenseService');
const { createSetupRoutes } = require('./routes/setupRoutes');
const { createSetupGate } = require('./middleware/setupGate');
const { createSetupService } = require('./setup/setupService');
const appPaths = require('./lib/appPaths');
const { createUpdateService, createDefaultSpawnUpdater, readCurrentVersion } = require('./update/updateService');
const { createUpdateRoutes } = require('./routes/updateRoutes');
const { createBackupService } = require('./security/backupService');
const { createBackupRoutes } = require('./routes/backupRoutes');
const { loadOrCreateSetupToken } = require('./security/setupAccess');
const dbDriver = require('./db');
const {
  pinRateLimiter,
  signSessionToken,
  attachUser,
  requireRole,
  securityHeaders
} = require('./middleware/auth');
const {
  validateOrderPayload,
  validateOrderStatusPayload,
  validateKdsStatusPayload,
  validateShiftOpenPayload
} = require('./middleware/validate');

const getConfig = () => configStore.getConfig();

const wompiService = new WompiService(getConfig);
const smsService = new SmsService(getConfig);
const whatsappService = new WhatsAppService(getConfig);

const licenseService = createLicenseService({ getConfig });
const setupService = createSetupService({ configStore, aldeloService });

const PORT_NUMBER = Number(process.env.PORT) || 80;
const updateService = createUpdateService({
  appRoot: appPaths.APP_ROOT,
  dataDir: appPaths.DATA_DIR,
  currentVersion: readCurrentVersion(appPaths.APP_ROOT, require('../package.json').version),
  isPackaged: appPaths.IS_PACKAGED,
  getConfig,
  getChannel: () => (licenseService.getStatus().license || {}).channel || 'stable',
  spawnUpdater: appPaths.IS_PACKAGED
    ? createDefaultSpawnUpdater({
        execPath: process.execPath,
        workDir: path.join(appPaths.DATA_DIR, 'update-work'),
        serviceExe: path.join(appPaths.APP_ROOT, 'serviplus-service.exe'),
        port: PORT_NUMBER,
        appRoot: appPaths.APP_ROOT,
        dataDir: appPaths.DATA_DIR
      })
    : null
});

const initialConfig = getConfig();
let cloudBridgeClient = null;
// El puente cloud solo arranca con licencia vigente (o en cuanto se active).
function startCloudBridgeIfLicensed() {
  if (cloudBridgeClient || !(initialConfig.cloud && initialConfig.cloud.enabled)) return;
  if (!licenseService.getStatus().allowed) return;
  cloudBridgeClient = new CloudBridgeClient(getConfig);
  cloudBridgeClient.start();
}
startCloudBridgeIfLicensed();
licenseService.onChange(startCloudBridgeIfLicensed);

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOriginSetting = allowedOrigins.length > 0 ? allowedOrigins : '*';

const io = new Server(server, {
  cors: {
    origin: corsOriginSetting,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

// Estabilidad global del proceso en tienda
process.on('uncaughtException', (err) => {
  console.error('[Process UncaughtException]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process UnhandledRejection]:', reason);
});

app.use(securityHeaders);
app.use(cors({ origin: corsOriginSetting }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(attachUser);

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

// Licencia: el gate va antes de cualquier ruta operativa o estática.
app.use('/api/license', createLicenseRoutes(licenseService));
app.use('/api/setup', createSetupRoutes(setupService));
app.use('/api/updates', createUpdateRoutes(updateService));

const backupService = createBackupService({
  dataDir: appPaths.DATA_DIR,
  getConnection: () => dbDriver.connection
});
app.use('/api/backups', createBackupRoutes({
  backupService,
  licenseService,
  dbDriver,
  isSetupComplete: () => setupService.isComplete()
}));
app.use(createLicenseGate(licenseService));
app.use(createSetupGate(setupService));
licenseService.onChange((summary) => io.emit('license:status', summary));

// Ping legacy endpoint for connectivity discovery
app.all('/ping', (req, res) => {
  const key = (req.body && req.body.key) || req.query.key || req.ip || '127.0.0.1';
  res.json({ code: 0, responseip: key });
});

// Socket.io connection handling (rooms por terminal + KDS mirroring)
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('terminal:join', (room) => {
    const allowedRooms = ['kiosk', 'pos', 'kds', 'turns', 'admin'];
    if (typeof room === 'string' && allowedRooms.includes(room)) {
      socket.join(room);
    }
  });

  socket.on('kds:mirror_sync', (data) => {
    socket.broadcast.emit('kds:mirror_sync', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// 1. CATÁLOGO Y PRODUCTOS
// ============================================================================

app.get('/api/menu', async (req, res) => {
  try {
    const categories = await aldeloService.getMenu();
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('Error in /api/menu:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products/admin', requireRole('cashier', 'admin'), async (req, res) => {
  try {
    const products = await aldeloService.getAllProductsAdmin();
    res.json({ success: true, data: products });
  } catch (err) {
    console.error('Error in /api/products/admin:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products/:id/toggle-active', requireRole('cashier', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const result = await aldeloService.setProductAvailability(id, isActive);

    auditService.record({
      action: 'PRODUCT_AVAILABILITY_TOGGLE',
      actor: (req.user && req.user.name) || 'staff',
      target: id,
      details: { isActive: Boolean(isActive) }
    });

    if (io) {
      io.emit('product:status_changed', { id: parseInt(id, 10), isActive: Boolean(isActive) });
      io.emit('kiosk:menu_updated', { trigger: 'toggle_product', id, isActive });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error in /api/products/:id/toggle-active:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. GESTIÓN DE TURNOS DE CAJA (Apertura, Arqueo en Vivo y Cierre Z)
// ============================================================================

app.use('/api/cashier/shift', createCashShiftRoutes(io));
app.use('/api/admin', createAdminRoutes());

// ============================================================================
// 3. EMPLEADOS, AUTENTICACIÓN Y MESAS
// ============================================================================

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await aldeloService.getEmployees();
    res.json({ success: true, data: employees });
  } catch (err) {
    console.error('Error in /api/employees:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', pinRateLimiter, async (req, res) => {
  try {
    const { pin } = req.body || {};
    const result = await aldeloService.verifyEmployeeLogin(pin);
    if (!result.success) {
      if (req.recordFailedPinAttempt) req.recordFailedPinAttempt();
      return res.status(401).json({ success: false, error: result.error });
    }
    if (req.clearPinAttempts) req.clearPinAttempts();
    const token = signSessionToken(result.employee, '12h');
    res.json({
      success: true,
      data: {
        token,
        employee: result.employee
      }
    });
  } catch (err) {
    console.error('Error in /api/auth/login:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const tables = await aldeloService.getTables();
    res.json({ success: true, data: tables });
  } catch (err) {
    console.error('Error in /api/tables:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 4. ÓRDENES Y COCINA (KDS)
// ============================================================================

app.get('/api/orders/active', async (req, res) => {
  try {
    const orders = await aldeloService.getActiveOrders();
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('Error in /api/orders/active:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders', validateOrderPayload, async (req, res) => {
  try {
    const {
      employeeId,
      items,
      paymentMethod,
      notes,
      tableId,
      guestNumber,
      orderType,
      isPaid,
      transactionRef,
      wompiTransactionId
    } = req.body;

    const newOrder = await aldeloService.createOrder({
      employeeId: employeeId || (req.user && req.user.employeeId) || 1,
      orderType: orderType || 1,
      items,
      paymentMethod: paymentMethod || 'CASH',
      notes,
      tableId,
      guestNumber,
      isPaid: isPaid !== undefined ? !!isPaid : true,
      transactionRef,
      wompiTransactionId
    });

    const activeOrders = await aldeloService.getActiveOrders();
    const fullOrder = activeOrders.find((o) => o.id === newOrder.orderId) || newOrder;

    const receiptInfo = receiptService.generateReceiptCode(newOrder.orderId);
    fullOrder.receiptCode = receiptInfo.urlCode;
    fullOrder.receiptUrl = receiptInfo.path;
    fullOrder.receiptFullUrl = receiptInfo.fullUrl;
    fullOrder.transactionRef = receiptInfo.transactionRef;

    io.emit('order:new', fullOrder);
    console.log(`[Order Created] Order #${newOrder.orderId} emitted via Socket.io`);

    // Impresión automática en impresora térmica
    try {
      const prnCfg = printerService.getPrinterConfig();
      if (prnCfg.enabled && prnCfg.autoPrintOrder) {
        const printPayload = {
          orderId: newOrder.orderId,
          orderNumber: newOrder.orderNumber,
          orderType: orderType || 1,
          tableId,
          items: fullOrder.items || items || [],
          total: fullOrder.total || newOrder.total || 0,
          paymentMethod: paymentMethod || 'CASH',
          receiptCode: receiptInfo.urlCode,
          receiptFullUrl: receiptInfo.fullUrl,
          notes: notes || ''
        };
        const printType = prnCfg.autoPrintKitchen ? 'both' : (prnCfg.printCustomerReceipt ? 'customer' : 'kitchen');
        printerService.printOrder(printPayload, { type: printType })
          .then((pRes) => console.log(`[Printer] Auto-impresión completada orden #${newOrder.orderId}:`, pRes.success))
          .catch((pErr) => console.warn(`[Printer] Error en auto-impresión orden #${newOrder.orderId}:`, pErr.message));
      }
    } catch (printErr) {
      console.warn('[Printer] Excepción preparando auto-impresión:', printErr.message);
    }

    res.status(201).json({ success: true, data: fullOrder });
  } catch (err) {
    console.error('Error in POST /api/orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1 = OpenOrder, 2 = SettledOrder, 3 = VoidedOrder
app.put('/api/orders/:id/status', requireRole('cashier', 'admin'), validateOrderStatusPayload, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { status, tableReady, paymentMethod, employeeId } = req.body;

    const result = await aldeloService.updateOrderStatus(
      orderId,
      status,
      tableReady,
      paymentMethod,
      employeeId || (req.user && req.user.employeeId) || 1
    );

    if (status === '2') {
      io.emit('kds:status_changed', { orderId, kdsStatus: 'PREPARING', tableReady: false });
    }

    auditService.record({
      action: status === '3' ? 'ORDER_VOID' : 'ORDER_STATUS_CHANGE',
      actor: (req.user && req.user.name) || employeeId || 'cashier',
      target: orderId,
      details: { status, tableReady, paymentMethod }
    });

    io.emit('order:status_changed', { orderId, status, tableReady, isPaid: status === '2' });
    console.log(`[Order Status] Order #${orderId} changed to ${status} (isPaid: ${status === '2'})`);

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error in PUT /api/orders/:id/status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/orders/:id/kds-status', validateKdsStatusPayload, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
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

// ============================================================================
// 5. PAGOS DIGITALES WOMPI (BANCOLOMBIA QR / CHECKOUT / WEBHOOK)
// ============================================================================

app.post('/api/payments/wompi/qr', async (req, res) => {
  try {
    const { orderId, amount, customerEmail, cart, tableId, orderType } = req.body || {};
    const result = await wompiService.createBancolombiaQrTransaction({
      orderId: orderId || Date.now(),
      amount: parseFloat(amount) || 0,
      customerEmail: customerEmail || 'kiosco@serviplus.pos'
    });

    if (result && result.reference) {
      aldeloService.saveKioskPaymentIntent({
        reference: result.reference,
        transactionId: result.transactionId || '',
        amount: parseFloat(amount) || 0,
        amountCOP: result.amountInCOP,
        customerEmail: customerEmail || 'kiosco@serviplus.pos',
        cart: cart || [],
        tableId: tableId || 0,
        orderType: orderType || 1
      }).catch((e) => console.error('[KioskPayments Access Error]:', e.message));

      paymentStore.savePayment({
        reference: result.reference,
        transactionId: result.transactionId,
        orderId: orderId || null,
        amount: parseFloat(amount) || 0,
        amountInCOP: result.amountInCOP,
        amountInCents: result.amountInCents,
        status: result.status || 'PENDING',
        paymentMethod: 'WOMPI_QR',
        checkoutUrl: result.checkoutUrl,
        qrId: result.qrId,
        customerEmail: customerEmail || 'kiosco@serviplus.pos'
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error generating Wompi QR:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payments/wompi/intent', (req, res) => {
  try {
    const { amount, reference: customRef } = req.body || {};
    const aldeloAmount = parseFloat(amount) || 0;
    const amountInCOP = Math.round(aldeloAmount * 1000);
    const amountInCents = amountInCOP * 100;
    const reference = customRef || `SP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const creds = wompiService.getActiveCredentials();
    const signature = wompiService.generateIntegritySignature(reference, amountInCents, creds.currency);

    let checkoutUrl = `https://checkout.wompi.co/p/?public-key=${creds.publicKey}&currency=${creds.currency}&amount-in-cents=${amountInCents}&reference=${reference}`;
    if (signature) {
      checkoutUrl += `&signature:integrity=${signature}`;
    }

    paymentStore.savePayment({
      reference,
      amount: aldeloAmount,
      amountInCOP,
      amountInCents,
      status: 'PENDING',
      paymentMethod: 'WOMPI_CHECKOUT',
      checkoutUrl
    });

    res.json({
      success: true,
      data: {
        reference,
        amountInCOP,
        amountInCents,
        currency: creds.currency,
        publicKey: creds.publicKey,
        signature,
        checkoutUrl,
        mode: creds.mode
      }
    });
  } catch (err) {
    console.error('Error generating Wompi intent:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/payments/wompi/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await wompiService.getTransactionStatus(id);
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transacción no encontrada' });
    }

    aldeloService.updateKioskPaymentStatus(id, tx.status, { transactionId: id }).catch(() => {});
    paymentStore.updateStatus(id, tx.status, {
      amountInCOP: tx.amountInCOP,
      amountInCents: tx.amountInCents,
      finalizedAt: tx.finalizedAt
    });

    res.json({ success: true, data: tx });
  } catch (err) {
    console.error('Error fetching Wompi transaction status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payments/wompi/webhook', (req, res) => {
  try {
    const event = req.body;
    console.log('[Wompi Webhook received]:', JSON.stringify(event));

    const sigCheck = wompiService.validateWebhookSignature(event);
    if (!sigCheck.ok) {
      console.warn('[Wompi Webhook] Firma rechazada:', sigCheck.reason);
      return res.status(403).json({ error: 'Firma de webhook inválida' });
    }

    if (event && event.data && event.data.transaction && io) {
      const tx = event.data.transaction;

      aldeloService.updateKioskPaymentStatus(tx.reference, tx.status, { transactionId: tx.id }).catch(() => {});
      paymentStore.updateStatus(tx.reference, tx.status, {
        transactionId: tx.id,
        amountInCOP: tx.amount_in_cents / 100,
        amountInCents: tx.amount_in_cents,
        finalizedAt: tx.finalized_at
      });

      io.emit(`payment:${tx.reference}`, {
        status: tx.status,
        amount: tx.amount_in_cents / 100,
        amountInCOP: tx.amount_in_cents / 100,
        aldeloAmount: (tx.amount_in_cents / 100) / 1000,
        reference: tx.reference,
        transactionId: tx.id
      });
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6. CONFIGURACIÓN DEL SISTEMA (PÚBLICA Y ADMINISTRATIVA)
// ============================================================================

app.get('/api/config/public', (req, res) => {
  try {
    res.json({
      success: true,
      data: configStore.getPublicConfig()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 7. RECIBOS DIGITALES, WHATSAPP Y SMS
// ============================================================================

app.post('/api/orders/:id/receipt', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { type, destination } = req.body || {};

    const receiptInfo = receiptService.generateReceiptCode(orderId);
    console.log(`[Receipt] Recibo digital solicitado para Orden #${orderId}: tipo=${type}, destino=${destination}, url=${receiptInfo.path}`);

    let sendResult = null;
    const config = getConfig();
    const restaurantName = config.restaurant?.name || 'Serviplus';

    if (type === 'whatsapp' && destination) {
      const body = `¡Hola! 👋 Aquí tienes el comprobante de tu pedido #${orderId} en ${restaurantName}:\n\n🔗 ${receiptInfo.fullUrl}\n\n¡Gracias por tu compra!`;
      sendResult = await whatsappService.sendMessage(destination, body);
    } else if (type === 'sms' && destination) {
      sendResult = await smsService.sendReceiptSms({
        phone: destination,
        receiptUrl: receiptInfo.fullUrl,
        orderNumber: orderId
      });
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

app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, phone, body, message, orderNumber, orderId, receiptUrl } = req.body || {};
    const targetNumber = to || phone;

    let finalReceiptUrl = receiptUrl || '';
    const targetId = orderId || orderNumber;
    if (targetId && (!finalReceiptUrl || finalReceiptUrl.includes('192.168.') || finalReceiptUrl.includes('localhost') || finalReceiptUrl.endsWith('/p/'))) {
      try {
        const info = receiptService.generateReceiptCode(parseInt(targetId, 10));
        if (info && info.fullUrl) finalReceiptUrl = info.fullUrl;
      } catch (_) {}
    }
    if (finalReceiptUrl && (finalReceiptUrl.includes('192.168.') || finalReceiptUrl.includes('localhost') || finalReceiptUrl.includes('127.0.0.1'))) {
      const pIdx = finalReceiptUrl.indexOf('/p/');
      if (pIdx !== -1) {
        finalReceiptUrl = `https://serviplus.upaysolutions.app${finalReceiptUrl.substring(pIdx)}`;
      }
    }

    if (finalReceiptUrl) {
      try {
        const components = [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: String(orderNumber || orderId || '1') },
              { type: 'text', text: String(finalReceiptUrl) }
            ]
          }
        ];
        const tplResult = await whatsappService.sendTemplateMessage(targetNumber, 'serviplus_receipt_v1', 'es', components);
        return res.json(tplResult);
      } catch (tplErr) {
        console.warn('[POST /api/whatsapp/send] Fallback plantilla falló, enviando texto:', tplErr.message);
      }
    }

    let messageBody = body || message;
    if (!messageBody && finalReceiptUrl) {
      const config = getConfig();
      const restaurantName = config.restaurant?.name || 'Serviplus';
      messageBody = `¡Hola! 👋 Aquí tienes el comprobante de tu pedido #${orderNumber || orderId || ''} en ${restaurantName}:\n\nVer Recibo Digital:\n${finalReceiptUrl}\n\n¡Gracias por tu compra!`;
    }

    const result = await whatsappService.sendMessage(targetNumber, messageBody);
    res.json(result);
  } catch (err) {
    console.error('Error in POST /api/whatsapp/send:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// ============================================================================
// 8. MÓDULO DE IMPRESIÓN TÉRMICA ESC/POS (TICKETS Y COMANDAS)
// ============================================================================

app.get('/api/printer/status', async (req, res) => {
  try {
    const status = await printerService.getPrinterStatus();
    const config = printerService.getPrinterConfig();
    res.json({ success: true, data: { ...status, config } });
  } catch (err) {
    console.error('Error in GET /api/printer/status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/printer/list', async (req, res) => {
  try {
    const result = await printerService.listInstalledPrinters();
    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/printer/list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/printer/config', requireRole('admin', 'cashier'), (req, res) => {
  try {
    const updated = printerService.updatePrinterConfig(req.body);
    res.json(updated);
  } catch (err) {
    console.error('Error in POST /api/printer/config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/printer/test', requireRole('admin', 'cashier'), async (req, res) => {
  try {
    const { printerName } = req.body || {};
    const result = await printerService.printTestTicket(printerName);
    res.json(result);
  } catch (err) {
    console.error('Error in POST /api/printer/test:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/printer/order/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { type = 'customer', copies = 1, printerName } = req.body || {};

    let orderData = await aldeloService.getOrderReceiptData(orderId);
    if (!orderData) {
      const activeOrders = await aldeloService.getActiveOrders();
      const found = activeOrders.find((o) => o.id === orderId);
      if (found) {
        orderData = {
          orderId: found.id,
          orderNumber: found.orderNumber || found.id,
          orderType: found.orderType || 1,
          tableId: found.tableId,
          items: found.items || [],
          total: found.total || 0,
          paymentMethod: found.paymentMethod || 'CASH'
        };
      }
    }

    if (!orderData) {
      return res.status(404).json({ success: false, error: `Orden #${orderId} no encontrada` });
    }

    const receiptInfo = receiptService.generateReceiptCode(orderId);
    orderData.receiptCode = receiptInfo.urlCode;
    orderData.receiptFullUrl = receiptInfo.fullUrl;

    const printResult = await printerService.printOrder(orderData, { type, copies, printerName });
    res.json(printResult);
  } catch (err) {
    console.error(`Error in POST /api/printer/order/${req.params.id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/printer/order', async (req, res) => {
  try {
    const payload = req.body || {};
    const { type = 'customer', copies = 1, printerName } = payload;

    if (payload.receiptCode && !payload.receiptFullUrl) {
      payload.receiptFullUrl = `https://serviplus.upaysolutions.app/p/${payload.receiptCode}`;
    }

    const printResult = await printerService.printOrder(payload, { type, copies, printerName });
    res.json(printResult);
  } catch (err) {
    console.error('Error in POST /api/printer/order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/printer/shift', requireRole('cashier', 'admin'), async (req, res) => {
  try {
    const { shiftData, isClosing, printerName } = req.body || {};
    const data = shiftData || cashShiftService.getCurrentShift();
    if (!data) {
      return res.status(400).json({ success: false, error: 'No hay datos de turno para imprimir' });
    }
    const result = await printerService.printCashShift(data, Boolean(isClosing), printerName);
    res.json(result);
  } catch (err) {
    console.error('Error in POST /api/printer/shift:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/printer/drawer/open', requireRole('cashier', 'admin'), async (req, res) => {
  try {
    const { printerName } = req.body || {};
    const result = await printerService.openCashDrawer(printerName);
    auditService.record({
      action: 'CASH_DRAWER_OPEN',
      actor: (req.user && req.user.name) || 'cashier',
      target: printerName || 'default_printer'
    });
    res.json(result);
  } catch (err) {
    console.error('Error in POST /api/printer/drawer/open:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 9. VISTAS WEB Y RUTAS SPA
// ============================================================================

app.get(['/p/:code', '/p/p/:code', '/receipt/:code', '/r/:code'], async (req, res) => {
  try {
    const { code } = req.params;
    const verified = receiptService.verifyReceiptCode(code);

    if (!verified) {
      const safeCode = String(code || '').replace(/[<>&"']/g, '');
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
            <p class="text-xs font-mono text-gray-400 mt-1">${safeCode}</p>
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

// Rutas directas hacia la SPA React (Rutas Limpias sin prefijo /react)
const reactDistDir = appPaths.CLIENT_DIST;
app.use(express.static(reactDistDir));
app.use('/assets', express.static(path.join(reactDistDir, 'assets')));
app.get(['/activate', '/setup', '/kiosk', '/kds', '/kds/*', '/display', '/front', '/front/*', '/admin', '/pos', '/pos/*', '/cashier', '/cash-in'], (req, res) => {
  res.sendFile(path.join(reactDistDir, 'index.html'));
});

app.get(['/react', '/react/*'], (req, res) => {
  res.redirect('/');
});

app.get(['/turns', '/monitor'], (req, res) => {
  res.sendFile(path.join(appPaths.PUBLIC_DIR, 'modern/turns.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(appPaths.PUBLIC_DIR, 'index.html'));
});

app.get(['/old', '/old/*'], (req, res) => {
  res.redirect('/#/mesas');
});

app.get(['/modern', '/modern/*'], (req, res) => {
  res.sendFile(path.join(appPaths.PUBLIC_DIR, 'modern/index.html'));
});

app.get('/visor', (req, res) => {
  res.redirect('/#/visor');
});

// Servir archivos estáticos públicos (imágenes, sonidos, app clásica)
const publicDir = appPaths.PUBLIC_DIR;
app.use(express.static(publicDir));

// Manejador de errores centralizado
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Express Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

const PORT = process.env.PORT || 80;

/** Arranca la licencia y pone el servidor a escuchar. Lo llama el dev (abajo) y el exe (SEA). */
function start() {
  if (!setupService.isComplete()) {
    loadOrCreateSetupToken(appPaths.DATA_DIR);
    console.log(`[Setup] Configuración pendiente. Desde la red, usa el token de ${path.join(appPaths.DATA_DIR, 'setup-token.txt')}`);
  }
  licenseService.start();
  updateService.start();
  backupService.start();
  server.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log('🚀 Serviplus Unified POS & Kiosk Gateway Server on:');
    console.log(`   http://localhost:${PORT}`);
    console.log(`📦 Productos DB: ${aldeloService.getProductsSource ? aldeloService.getProductsSource() : 'C:\\SP\\B\\kebab.mdb'}`);
    console.log('====================================================');
  });
  return { app, server, io };
}

// En desarrollo (`node server/index.js`) arranca solo. En el exe lo arranca el cargador SEA.
if (require.main === module) start();

module.exports = { app, server, io, licenseService, setupService, updateService, backupService, start };
