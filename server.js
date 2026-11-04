const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const os = require('os');
const moment = require('moment');
const ADODB = require('./node_modules/node-adodb/lib/client');

// Cargar configuración dinámica
let appConfig = {};
function loadAppConfig() {
    try {
        appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    } catch (e) {
        console.error('Error loading config.json:', e.message);
    }
    return appConfig;
}
loadAppConfig();

const dbConnString = (appConfig.db && appConfig.db.connectionString) || 'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\SP\\B\\kebab.mdb;';
const connection = ADODB.open(dbConnString);

const aldeloService = require('./server/aldeloService');
const receiptService = require('./server/receiptService');
const WompiService = require('./server/wompiService');
const SmsService = require('./server/smsService');
const paymentStore = require('./server/paymentStore');

const wompiService = new WompiService(() => appConfig);
const smsService = new SmsService(() => appConfig);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

const JWT_KEY = 'Medalla6571';
let dataordenes = {};
let ordenesreplace = {};
let stdata = { StationID: 1 };
let SalesTaxRate = 0;
let GSTRate = 0;

// Manejadores globales de errores para estabilidad
process.on('uncaughtException', (err) => {
    console.error('[Process Error]:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection]:', reason);
});

// Socket.io: comunicación en tiempo real y sincronización Mirroring KDS
io.on('connection', (clientSocket) => {
    clientSocket.on('kds:mirror_sync', (data) => {
        clientSocket.broadcast.emit('kds:mirror_sync', data);
    });
});

// Middleware CORS
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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

// ============================================================================
// 1. API MODERNA (KIOSK AUTOSERVICIO, KDS Y TURNOS)
// ============================================================================

// Menú completo con categorías y modificadores
app.get('/api/menu', async (req, res) => {
    try {
        const categories = await aldeloService.getMenu();
        res.json({ success: true, data: categories });
    } catch (err) {
        console.error('Error in /api/menu:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Lista de empleados / cajeros
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await aldeloService.getEmployees();
        res.json({ success: true, data: employees });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mesas activas de comedor
app.get('/api/tables', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const tables = await aldeloService.getTables();
        res.json({ success: true, data: tables });
    } catch (err) {
        console.error('Error in /api/tables:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Órdenes activas (KDS, Monitor de turnos, Caja)
app.get('/api/orders/active', async (req, res) => {
    try {
        const orders = await aldeloService.getActiveOrders();
        res.json({ success: true, data: orders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Crear orden (Kiosk o Caja)
app.post('/api/orders', async (req, res) => {
    try {
        const { employeeId, items, paymentMethod, notes, tableId, guestNumber, orderType, isPaid, transactionRef, wompiTransactionId } = req.body;

        const newOrder = await aldeloService.createOrder({
            employeeId: employeeId || 1,
            orderType: orderType || 1,
            items: items || [],
            paymentMethod: paymentMethod || 'CASH',
            notes: notes || '',
            tableId: tableId || null,
            guestNumber: guestNumber || 1,
            isPaid: (isPaid !== undefined) ? !!isPaid : true,
            transactionRef: transactionRef || '',
            wompiTransactionId: wompiTransactionId || ''
        });

        let fullOrder = {};
        try {
            const activeOrders = await aldeloService.getActiveOrders();
            fullOrder = (activeOrders && activeOrders.find(o => o.id === newOrder.orderId)) || {};
        } catch (actErr) {
            console.error('[POST /api/orders] getActiveOrders err:', actErr.message);
        }

        const responseData = Object.assign({}, newOrder, fullOrder, {
            id: newOrder.orderId,
            orderId: newOrder.orderId,
            orderNumber: newOrder.orderNumber
        });

        if (io) {
            try {
                io.emit('order:new', responseData);
                console.log(`[Order Created] Order #${newOrder.orderId} emitted via Socket.io`);
            } catch (ioErr) {
                console.error('[POST /api/orders] io.emit err:', ioErr.message);
            }
        }

        // Sincronizar visor clásico si está activo
        try { pedidomesa(); } catch (e) { }

        res.status(201).json({ success: true, data: responseData });
    } catch (err) {
        let errorMsg = err.message || 'Error al procesar la orden en base de datos.';
        if (err.process) {
            try {
                const parsed = typeof err.process === 'string' ? JSON.parse(err.process) : err.process;
                if (parsed && parsed.message) errorMsg = parsed.message;
            } catch (_) {
                errorMsg = String(err.process);
            }
        }
        console.error('Error in POST /api/orders:', errorMsg, err.sql || '');
        res.status(500).json({ success: false, error: errorMsg });
    }
});

// Solicitar Recibo Digital (Email / SMS con Hablame Colombia)
app.post('/api/orders/:id/receipt', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { type, destination } = req.body;
        const receiptInfo = receiptService.generateReceiptCode(orderId);
        
        let smsResult = null;
        if (type === 'sms' && destination) {
            smsResult = await smsService.sendReceiptSms(destination, receiptInfo.fullUrl, {
                restaurantName: appConfig.restaurant?.name || 'Serviplus'
            });
        }

        console.log(`[Receipt] Recibo digital #${orderId} (${type} -> ${destination}): ${receiptInfo.path}`);
        res.json({
            success: true,
            data: {
                orderId,
                receiptCode: receiptInfo.urlCode,
                receiptUrl: receiptInfo.path,
                transactionRef: receiptInfo.transactionRef,
                receiptFullUrl: receiptInfo.fullUrl,
                smsResult
            },
            message: `Recibo digital ${type === 'sms' ? 'enviado por SMS' : 'registrado'} con éxito a ${destination}`
        });
    } catch (err) {
        console.error('Error in POST /api/orders/:id/receipt:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Consultar datos JSON de un recibo por su código único de 13 caracteres
app.get(['/api/receipts/:code', '/api/receipts/p/:code'], async (req, res) => {
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
                transactionRef: verified.transactionRef || ('SP-' + verified.txId),
                receiptCode: code
            }
        });
    } catch (err) {
        console.error('Error in GET /api/receipts/:code:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Renderizar vista HTML pública del Recibo Digital (estilo móvil upaysolutions.app)
app.get(['/p/:code', '/p/p/:code', '/receipt/:code', '/receipt/p/:code', '/r/:code', '/r/p/:code'], async (req, res) => {
    try {
        const { code } = req.params;
        const verified = receiptService.verifyReceiptCode(code);
        if (!verified) {
            return res.status(404).send('<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Recibo No Encontrado</h2><p>El código de recibo digital es inválido o no existe.</p><a href="/">Volver</a></body></html>');
        }
        const orderData = await aldeloService.getOrderReceiptData(verified.orderId);
        if (!orderData) {
            return res.status(404).send('La orden asociada a este recibo no se encuentra disponible.');
        }
        const html = receiptService.renderReceiptHtml({
            ...orderData,
            transactionRef: verified.transactionRef || ('SP-' + verified.txId)
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        console.error('Error rendering digital receipt:', err);
        res.status(500).send('Error al procesar el recibo digital.');
    }
});

// Actualizar estado de orden según especificación Aldelo POS (1=Open, 2=Settled, 3=Voided)
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { status, tableReady, paymentMethod, employeeId } = req.body;

        await aldeloService.updateOrderStatus(orderId, status, tableReady, paymentMethod, employeeId);

        if (io) {
            io.emit('order:status_changed', { orderId, status, tableReady, isPaid: status === '2' });
            console.log(`[Order Status] Order #${orderId} changed to ${status}${tableReady !== undefined ? ` (tableReady: ${tableReady})` : ''}`);
        }

        try { pedidomesa(); } catch (e) { }

        res.json({ success: true, data: { orderId, status, tableReady } });
    } catch (err) {
        console.error('Error in PUT /api/orders/:id/status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Estado operativo exclusivo de Cocina (KDS: PENDING, COOKING, READY, SERVED)
app.put('/api/orders/:id/kds-status', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { kdsStatus, itemChecks } = req.body;

        const result = await aldeloService.updateKdsStatus(orderId, kdsStatus, itemChecks);

        if (io) {
            io.emit('kds:status_changed', {
                orderId,
                kdsStatus: result.kdsStatus,
                itemChecks: result.itemChecks,
                tableReady: result.kdsStatus === 'READY'
            });
            console.log(`[KDS Status] Order #${orderId} KDS status updated to ${result.kdsStatus}`);
        }

        try { pedidomesa(); } catch (e) { }

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error in PUT /api/orders/:id/kds-status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 1b. PAGOS DIGITALES WOMPI (BANCOLOMBIA QR / CHECKOUT)
// ============================================================================

// Crear QR oficial de Bancolombia para mostrar en la pantalla del Kiosco
app.post('/api/payments/wompi/qr', async (req, res) => {
    try {
        const { orderId, amount, customerEmail, cart, tableId, orderType } = req.body;
        const result = await wompiService.createBancolombiaQrTransaction({
            orderId: orderId || Date.now(),
            amount: parseFloat(amount) || 0,
            customerEmail: customerEmail || 'kiosco@serviplus.pos'
        });

        // Respaldo de Fase 1 (ANTES del pago): Guardar intención en tabla KioskPayments de Access
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
            }).catch(e => console.error('[KioskPayments Access Error]:', e.message));

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

// Enlace alternativo de Checkout Wompi con firma SHA-256
app.post('/api/payments/wompi/intent', (req, res) => {
    try {
        const { amount, reference: customRef } = req.body;
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

// Consultar estado de transacción Wompi (Sondeo / Polling desde Kiosco)
app.get('/api/payments/wompi/status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tx = await wompiService.getTransactionStatus(id);
        if (!tx) {
            return res.status(404).json({ success: false, error: 'Transacción no encontrada' });
        }

        // Actualizar respaldo en tabla KioskPayments de Access y local
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

// Webhook Wompi: Recepción de confirmaciones de pago
app.post('/api/payments/wompi/webhook', (req, res) => {
    try {
        const event = req.body;
        console.log('[Wompi Webhook received]:', JSON.stringify(event));

        // Validar firma criptográfica con timingSafeEqual
        const sigCheck = wompiService.validateWebhookSignature(event);
        if (!sigCheck.ok) {
            console.warn('[Wompi Webhook] Firma rechazada:', sigCheck.reason);
            return res.status(403).json({ error: 'Firma de webhook inválida' });
        }

        if (event && event.data && event.data.transaction && io) {
            const tx = event.data.transaction;

            // Actualizar respaldo en Access y local
            aldeloService.updateKioskPaymentStatus(tx.reference, tx.status, { transactionId: tx.id }).catch(() => {});
            paymentStore.updateStatus(tx.reference, tx.status, {
                transactionId: tx.id,
                amountInCOP: tx.amount_in_cents / 100,
                amountInCents: tx.amount_in_cents,
                finalizedAt: tx.finalized_at
            });

            io.emit(`payment:${tx.reference}`, {
                status: tx.status,
                amountInCOP: tx.amount_in_cents / 100,
                aldeloAmount: (tx.amount_in_cents / 100) / 1000,
                reference: tx.reference,
                transactionId: tx.id
            });
            console.log(`[Wompi Webhook] Notificación emitida a frontend: payment:${tx.reference} (${tx.status})`);
        }
        res.json({ received: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Historial de pagos respaldados (consultado de KioskPayments en Access)
app.get('/api/admin/payments', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        let payments = await aldeloService.getKioskPayments(limit);
        if (!payments || payments.length === 0) {
            payments = paymentStore.getAllPayments(limit);
        }
        res.json({ success: true, data: payments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 1c. ADMINISTRACIÓN Y CONFIGURACIÓN DEL SISTEMA (ALDELO ADMIN AUTH)
// ============================================================================

// Autenticación de Administrador / Gerente con código de acceso de Aldelo
app.post('/api/admin/auth', async (req, res) => {
    try {
        const { pin } = req.body;
        const result = await aldeloService.verifyAdminAccess(pin);
        if (!result.success) {
            return res.status(401).json({ success: false, error: result.error });
        }

        const adminToken = jwt.sign({
            employeeId: result.employee.id,
            name: result.employee.name,
            role: 'admin',
            securityLevel: result.employee.securityLevel
        }, JWT_KEY, { expiresIn: '8h' });

        res.json({
            success: true,
            data: {
                token: adminToken,
                employee: result.employee
            }
        });
    } catch (err) {
        console.error('Error in /api/admin/auth:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Configuración pública para el Kiosco y Recibos (sin credenciales privadas)
app.get('/api/config/public', (req, res) => {
    try {
        const current = loadAppConfig();
        res.json({
            success: true,
            data: {
                restaurant: current.restaurant,
                kiosk: current.kiosk,
                wompi: {
                    publicKey: current.wompi?.mode === 'sandbox' ? current.wompi?.sandbox?.publicKey : current.wompi?.publicKey,
                    mode: current.wompi?.mode,
                    methods: current.wompi?.methods
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Consultar configuración actual
app.get('/api/admin/config', (req, res) => {
    try {
        const current = loadAppConfig();
        res.json({ success: true, data: current });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Guardar configuración en caliente
app.post('/api/admin/config', (req, res) => {
    try {
        const newConfig = req.body;
        if (!newConfig || typeof newConfig !== 'object') {
            return res.status(400).json({ success: false, error: 'Configuración inválida' });
        }
        const merged = Object.assign({}, appConfig, newConfig);
        fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(merged, null, 2), 'utf8');
        appConfig = merged;
        console.log('[Admin] Configuración guardada exitosamente en config.json');
        res.json({ success: true, data: appConfig, message: 'Configuración actualizada con éxito' });
    } catch (err) {
        console.error('Error saving config.json:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 2. RUTAS WEB Y REDIRECCIONES
// ============================================================================

// Aplicación clásica (Angular)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get(['/old', '/old/*'], (req, res) => {
    res.redirect('/#/mesas');
});

// Aplicación moderna alternativa
app.get(['/modern', '/modern/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public/modern/index.html'));
});

// Aplicación React (SPA Kiosk & KDS)
app.use('/react', express.static(path.join(__dirname, 'client/dist')));
app.get(['/react', '/react/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Acceso directo a Kiosk Autoservicio en Pantalla Completa
app.get(['/kiosk', '/autoservice', '/kiosk-fs', '/kiosk-fullscreen'], (req, res) => {
    res.redirect('/react/?tab=kiosk&fullscreen=true');
});

// Redirigir al visor clásico
app.get('/visor', (req, res) => {
    res.redirect('/#/visor');
});

// Monitor de Turnos (TV Screen Status Board)
app.get(['/turns', '/monitor'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'modern', 'turns.html'));
});

// Ping de descubrimiento de conectividad
app.all('/ping', (req, res) => {
    const key = (req.body && req.body.key) || (req.query && req.query.key) || req.ip || '127.0.0.1';
    res.json({ code: 0, responseip: key });
});

// ============================================================================
// 3. ENDPOINTS COMPATIBILIDAD POS CLÁSICO (ANGULAR)
// ============================================================================

// Autenticación por código de acceso de empleado
app.post('/auth/login', (req, res) => {
    const key = (req.body && req.body.key) || '';
    const SQL = `SELECT EmployeeID as id, MiddleInitial as M, FirstName as N, LastName as LN, DineInNotAvail as Vr FROM EmployeeFiles WHERE (AccessCode='${key.replace(/'/g, "''")}')`;
    connection.query(SQL).on('done', (data) => {
        if (data.records && data.records.length > 0) {
            data.records[0].AccessCode = key;
            const token = jwt_encode(JWT_KEY, data.records[0]);
            res.json({
                code: 0,
                setup: data.records,
                response: { token: token.o, refresh_token: token.r }
            });
        } else {
            res.json({ code: 1, response: 0 });
        }
    }).on('fail', () => {
        res.json({ code: 1, response: 0 });
    });
});

// Refresco de token JWT
app.post('/auth/delegation', (req, res) => {
    const tokenr = req.body && req.body.refresh_token;
    const decoded = jwt_decode(tokenr, JWT_KEY + '_');
    if (decoded !== 'error' && decoded.SQL) {
        connection.query(decoded.SQL).on('done', (data) => {
            if (data.records && data.records.length > 0) {
                const token = jwt_encode(JWT_KEY, data.records[0]);
                res.json({ code: 0, response: { token: token.o, refresh_token: token.r } });
            } else {
                res.json({ code: 1, response: 0 });
            }
        }).on('fail', () => {
            res.json({ code: 1, response: 0 });
        });
    } else {
        res.json({ code: 1, response: 0 });
    }
});

// Mesas y grupos de mesas para el salón clásico
app.post('/home/mesas', (req, res) => {
    try {
        const token = req.body && req.body.atoken;
        const decoded = jwt_decode(token, JWT_KEY);
        if (decoded !== 'error' && decoded.SQL) {
            connection.query(decoded.SQL).on('done', () => {
                const SQL = "SELECT DineInTables.DineInTableID AS id, DineInTables.DineInTableText AS N, DineInTableGroups.TableGroupText AS G, DineInTableGroups.TableGroupID as Gid FROM DineInTableGroups INNER JOIN DineInTables ON DineInTableGroups.TableGroupID = DineInTables.TableGroupID";
                connection.query(SQL).on('done', (data) => {
                    const grupos = {};
                    (data.records || []).forEach((mesa) => {
                        grupos[mesa.Gid] = { m: mesa.G, selec: false };
                    });
                    res.json({ code: 0, response: { mesas: data.records, grupos } });
                }).on('fail', () => res.json({ code: 1, response: 0 }));
            }).on('fail', () => res.json({ code: 1, response: 0 }));
        } else {
            res.json({ code: 1, response: 0 });
        }
    } catch (err) {
        res.json({ code: 1, response: 0 });
    }
});

// Estado y tiempo transcurrido de mesas activas
app.post('/home/mesastat', (req, res) => {
    try {
        const token = req.body && req.body.atoken;
        const decoded = jwt_decode(token, JWT_KEY);
        if (decoded !== 'error' && decoded.SQL) {
            connection.query(decoded.SQL).on('done', () => {
                const mesas = {};
                for (const id in dataordenes) {
                    const orden = dataordenes[id];
                    if (orden && orden.St === 1) {
                        const da = new Date(orden.Ot);
                        const daf = (Date.now() - da) / 1000;
                        let formattedTime = '';
                        if (daf < 60) {
                            formattedTime = daf.toFixed(0) + 'Seg';
                        } else if (daf < 3600) {
                            formattedTime = (daf / 60).toFixed(1) + ' Min';
                        } else {
                            formattedTime = (daf / 3600).toFixed(1) + 'Hr';
                        }

                        mesas[orden.tid] = {
                            oid: orden.oid,
                            id: orden.tid,
                            M: orden.Mo,
                            time: formattedTime,
                            GN: orden.GN,
                            T: orden.AmountDue
                        };
                    }
                }
                res.json({ code: 0, response: { mesas } });
            }).on('fail', () => res.json({ code: 1, response: 0 }));
        } else {
            res.json({ code: 1, response: 0 });
        }
    } catch (err) {
        res.json({ code: 1, response: 0 });
    }
});

// Visor clásico de cocina
app.all('/home/visor', (req, res) => {
    try {
        const last = parseInt((req.body && req.body.last) || (req.query && req.query.last), 10) || 0;
        const ordenesin = {};
        const ordenesout = [];

        for (const id in dataordenes) {
            const orden = dataordenes[id];
            if (!orden) continue;
            if (orden.oid > last) {
                ordenesin[orden.oid] = orden;
            }
            if (orden.St === 2) {
                ordenesout.push({ id: orden.oid, Lt: orden.Lt });
            }
        }
        res.json({
            code: 0,
            response: {
                ordenesin,
                ordenesout,
                ordenesreplace
            }
        });
    } catch (err) {
        console.error('Error in /home/visor:', err);
        res.json({ code: 1, response: 0 });
    }
});

// Categorías del menú para mesero clásico
app.post('/home/categorias', (req, res) => {
    const token = req.body && req.body.atoken;
    const decoded = jwt_decode(token, JWT_KEY);
    if (decoded !== 'error' && decoded.SQL) {
        connection.query(decoded.SQL).on('done', (data) => {
            if (data.records && data.records.length > 0) {
                const SQL = "SELECT MenuGroupID as id, MenuGroupText as N, DisplayIndex as DI from MenuGroups WHERE (DisplayIndex >= 0) ORDER BY DisplayIndex";
                connection.query(SQL).on('done', (grpData) => {
                    res.json({ code: 0, response: { categorias: grpData.records } });
                }).on('fail', () => res.json({ code: 1, response: 0 }));
            } else {
                res.json({ code: 1, response: 0 });
            }
        }).on('fail', () => res.json({ code: 1, response: 0 }));
    } else {
        res.json({ code: 1, response: 0 });
    }
});

// Productos y modificadores para mesero clásico
app.post('/home/product', (req, res) => {
    const token = req.body && req.body.atoken;
    const decoded = jwt_decode(token, JWT_KEY);
    if (decoded !== 'error' && decoded.SQL) {
        connection.query(decoded.SQL).on('done', (data) => {
            if (data.records && data.records.length > 0) {
                const SQL = "SELECT ScriptDetails AS SDS, MenuItems.MenuItemInActive as MIIA, MenuItems.MenuItemNotification as MINI, MenuItems.barcode, MenuItems.MenuItemType as MIT, MenuItems.MenuItemPopUpHeaderID as MIPHID, MenuItems.MenuGroupid as M, MenuItems.MenuItemID AS id, MenuItems.MenuItemText AS N, MenuItems.DefaultUnitPrice AS P, MenuItems.DisplayIndex as I FROM MenuItems, MenuGroups WHERE (((MenuItems.MenuGroupid)=[MenuGroups].[MenuGroupID]))";
                connection.query(SQL).on('done', (prodData) => {
                    const SQLMods = "SELECT DISTINCT MenuModifiers.MenuModifierID AS id, MenuModifiers.MenuModifierText AS N, MenuModifiers.AdditionalCost AS P, MenuModifierPopUps.MenuItemID as MID FROM MenuModifiers, MenuModifierPopUps WHERE (((MenuModifiers.MenuModifierID)=[MenuModifierPopUps].[MenuModifierID]))";
                    connection.query(SQLMods, 1).on('done', (modData) => {
                        res.json({
                            code: 0,
                            response: {
                                product: prodData.records,
                                modifi: modData.records
                            }
                        });
                    }).on('fail', () => res.json({ code: 1, response: 0 }));
                }).on('fail', () => res.json({ code: 1, response: 0 }));
            } else {
                res.json({ code: 1, response: 0 });
            }
        }).on('fail', () => res.json({ code: 1, response: 0 }));
    } else {
        res.json({ code: 1, response: 0 });
    }
});

// Crear pedido desde terminal de mesero clásico
app.post('/home/pedido', (req, res) => {
    try {
        const token = req.body && req.body.atoken;
        const pedido = typeof req.body.list === 'string' ? JSON.parse(req.body.list) : req.body.list;
        const decoded = jwt_decode(token, JWT_KEY);

        if (decoded !== 'error' && decoded.SQL) {
            const dtoday = Date.now();
            const datehoy = dtoday / 86400000 + 25569 - 1 / 6;

            connection.query(decoded.SQL).on('done', (data) => {
                if (data.records && data.records.length > 0) {
                    const PID = (pedido && pedido.pid) || 0;
                    const curStationID = (stdata && stdata.StationID) ? stdata.StationID : 1;
                    const curSalesTax = (typeof SalesTaxRate === 'number' && !isNaN(SalesTaxRate)) ? SalesTaxRate : 0;
                    const curGSTRate = (typeof GSTRate === 'number' && !isNaN(GSTRate)) ? GSTRate : 0;
                    const amountDue = (pedido && pedido.h && pedido.h.AmountDue) || 0;
                    const tax1 = (amountDue * curSalesTax) || 0;
                    const tax2 = (amountDue * curGSTRate) || 0;

                    let SQL;
                    if (PID > 0) {
                        SQL = `SELECT OrderID AS id FROM OrderHeaders WHERE OrderID=${PID}`;
                    } else {
                        SQL = `INSERT INTO OrderHeaders (OrderDateTime,EmployeeID,StationID,OrderType,DineInTableID,DeliveryCharge,DeliveryComp,SalesTaxRate,DiscountTaxable,OrderStatus,AmountDue,Kitchen1AlreadyPrinted,Kitchen2AlreadyPrinted,Kitchen3AlreadyPrinted,BarAlreadyPrinted,PackagerAlreadyPrinted,SubTotal,DiscountAmountUsed,SurchargeAmountUsed,SalesTaxAmountUsed,GSTRate,GSTAmountUsed,TableReady,GuestNumber,GuestCheckPrinted,ServerBankAmount,Kitchen4AlreadyPrinted,Kitchen5AlreadyPrinted,Kitchen6AlreadyPrinted,LiquorTaxRate,LiquorTaxAmount,RemoteSiteNumber,RemoteOrigRowID,StoreNumber,BarTabPreAuth,RowGUID) VALUES(${datehoy},${pedido.h.EmployeeID || 1},${curStationID},1,${pedido.h.DineInTableID || 1},0,0,${curSalesTax},0,1,${amountDue},1,1,1,1,0,${amountDue},0,0,${tax1},${curGSTRate},${tax2},0,${pedido.h.GuestNumber || 1},0,0,1,1,1,0,0,1,0,0,0,${rowid()})`;
                    }

                    const items = (pedido && pedido.p) || [];
                    const leng = items.length;

                    connection.executeScalar(SQL, 'SELECT @@Identity AS id').on('done', (data1) => {
                        if (data1.records && data1.records.length > 0) {
                            const orderid = (PID > 0) ? PID : data1.records[0].id;
                            if (leng === 0) {
                                pedidomesa();
                                return res.json({ code: 0, pedid: orderid, response: 0 });
                            }

                            let insertedCount = 0;
                            items.forEach((item) => {
                                let text = '';
                                let values = '';
                                let i = 1;
                                const comment = item.coment || '';

                                if (item.modifi && item.modifi.length > 0) {
                                    item.modifi.forEach((mi) => {
                                        text += `,Mod${i}ID,Mod${i}Cost`;
                                        values += `,${mi.id},${mi.P == null ? 0 : mi.P}`;
                                        i++;
                                    });
                                }
                                if (item.notas && item.notas.length > 0) {
                                    item.notas.forEach((mi) => {
                                        text += `,Mod${i}ID,Mod${i}Cost`;
                                        values += `,${mi.id},${mi.P == null ? 0 : mi.P}`;
                                        i++;
                                    });
                                }

                                const ep = (item.EP != null ? item.EP : item.P) * item.cant;
                                const SQL2 = `INSERT INTO OrderTransactions (ShortNote,DiscountTaxable,GSTTaxable,OrderID,MenuItemID,MenuItemUnitPrice,Quantity,ExtendedPrice,TransactionStatus,NotificationStatus,RowGUID${text}) VALUES('${comment.replace(/'/g, "''")}',1,-1,${orderid},${item.id},${item.P},${item.cant},${ep},1,2,${rowid()}${values})`;

                                connection.executeScalar(SQL2, 'SELECT @@Identity AS id').on('done', () => {
                                    insertedCount++;
                                    if (insertedCount >= leng) {
                                        pedidomesa();
                                        res.json({ code: 0, pedid: orderid, response: 0 });
                                    }
                                }).on('fail', (itemErr) => {
                                    console.error('Error inserting item in OrderTransactions:', itemErr);
                                    insertedCount++;
                                    if (insertedCount >= leng) {
                                        pedidomesa();
                                        res.json({ code: 0, pedid: orderid, response: 0 });
                                    }
                                });
                            });
                        } else {
                            res.json({ code: 1, response: "errortoken" });
                        }
                    }).on('fail', (headerErr) => {
                        console.error('Error in OrderHeader insert:', headerErr);
                        res.status(500).json({ code: 1, error: headerErr.message });
                    });
                } else {
                    res.json({ code: 1, response: 0 });
                }
            }).on('fail', () => res.status(401).json({ code: 1, response: 0 }));
        } else {
            res.json({ code: 1, response: 0 });
        }
    } catch (outerErr) {
        console.error('Error in /home/pedido:', outerErr);
        res.status(500).json({ code: 1, error: outerErr.message });
    }
});

// Reporte de ventas y domicilios por mesero/empleado
app.get('/report', (req, res) => {
    try {
        const dateParam = parseInt(req.query.date, 10) || 0;
        const date = new Date();
        const startDate = new Date(1900, 0, 1);
        const millisecondsInDay = 86400000;
        const diff = date - startDate;
        const initime = Math.floor(diff / millisecondsInDay) + 2 - dateParam;
        const finitime = Math.floor(diff / millisecondsInDay) + 2 - dateParam + 1;

        const SQL = `
          SELECT 
            OrderTransactions.OrderTransactionID, 
            OrderHeaders.OrderDateTime, 
            OrderTransactions.MenuItemID, 
            OrderHeaders.EmployeeID, 
            OrderHeaders.OrderStatus, 
            MenuItems.MenuItemText, 
            MenuItems.DefaultUnitPrice, 
            OrderTransactions.OrderID, 
            EmployeeFiles.FirstName, 
            EmployeeFiles.LastName, 
            MenuItems.ItemDelComp 
          FROM 
            EmployeeFiles 
            INNER JOIN (OrderHeaders 
              INNER JOIN (MenuItems 
                INNER JOIN OrderTransactions 
                ON MenuItems.MenuItemID = OrderTransactions.MenuItemID) 
              ON OrderHeaders.OrderID = OrderTransactions.OrderID) 
            ON EmployeeFiles.EmployeeID = OrderHeaders.EmployeeID 
            WHERE OrderHeaders.OrderDateTime >= ${initime} AND OrderHeaders.OrderDateTime < ${finitime}`;

        connection.query(SQL).on('done', (data) => {
            const datamap = {};
            let profit = 0;
            const records = (data && data.records) || [];
            records.forEach((record) => {
                record.OrderDateTime = moment.utc(record.OrderDateTime).local().format('MM-DD HH:mm');
                if (!datamap[record.EmployeeID]) {
                    datamap[record.EmployeeID] = { name: '', total: 0, pay: 0, list: [] };
                }
                datamap[record.EmployeeID].list.push(record);
                datamap[record.EmployeeID].total += record.DefaultUnitPrice;
                datamap[record.EmployeeID].pay += (record.ItemDelComp || 0);
                datamap[record.EmployeeID].name = `${record.FirstName} ${record.LastName}`;
                profit += record.DefaultUnitPrice - (record.ItemDelComp || 0);
            });
            res.json({ code: 1, profit, response: datamap });
        }).on('fail', (err) => {
            console.error('Error in /report query:', err);
            res.status(500).json({ code: 1, response: 0 });
        });
    } catch (err) {
        console.error('Error fetching report:', err);
        res.status(500).json({ code: 1, response: 0 });
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 4. FUNCIONES AUXILIARES & CICLO DE VIDA DEL SERVIDOR
// ============================================================================

function jwt_decode(token, key) {
    if (!token) return 'error';
    try {
        const d = jwt.verify(token, key);
        if (d && d.data && d.data.AccessCode) {
            return {
                SQL: `SELECT EmployeeID, AccessCode FROM EmployeeFiles WHERE (AccessCode='${d.data.AccessCode.replace(/'/g, "''")}')`
            };
        }
    } catch (_) { }
    return 'error';
}

function jwt_encode(secure, data) {
    return {
        o: jwt.sign({ exp: Math.floor(Date.now() / 1000) + (360 * 60), data }, secure),
        r: jwt.sign({ exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), data }, secure + '_')
    };
}

function rowid() {
    const letras = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    let code = '{';
    for (let i = 1; i <= 32; i++) {
        const index = Math.floor(Math.random() * 16);
        if (i === 9 || i === 13 || i === 17 || i === 21) code += '-';
        code += letras[index];
    }
    code += '}';
    return code;
}

function pedidomesa() {
    try {
        const dtoday = Date.now();
        const datehoy = dtoday / 86400000 + 25569 - 1 / 6;
        const dres = (datehoy - parseInt(datehoy, 10)) * 100000 - 1;
        const idres = parseInt(dres, 10) / 100000;
        const initime = datehoy - idres - 1;

        const baseSelect = "SELECT OrderTransactions.ExtendedPrice, OrderTransactions.TransactionStatus, OrderTransactions.OrderTransactionID, OrderTransactions.Mod1ID, OrderHeaders.EditTimestamp AS Lt, MenuItems.KitchenSortNumber AS Ctime, OrderTransactions.MenuItemUnitPrice, OrderTransactions.MenuItemID, OrderHeaders.GuestNumber, OrderHeaders.OrderDateTime AS t, OrderHeaders.AmountDue, OrderHeaders.OrderStatus AS st, OrderHeaders.DineInTableID AS tid, EmployeeFiles.FirstName AS M, OrderHeaders.OrderID, DineInTables.DineInTableText, MenuItems.MenuItemText, OrderTransactions.Quantity FROM (((OrderHeaders INNER JOIN EmployeeFiles ON OrderHeaders.EmployeeID = EmployeeFiles.EmployeeID) INNER JOIN (MenuItems INNER JOIN OrderTransactions ON MenuItems.MenuItemID = OrderTransactions.MenuItemID) ON OrderHeaders.OrderID = OrderTransactions.OrderID) LEFT JOIN DineInTables ON OrderHeaders.DineInTableID = DineInTables.DineInTableID)";
        const SQL = `(${baseSelect} WHERE (OrderHeaders.OrderDateTime >= ${initime})) UNION (${baseSelect} WHERE (OrderHeaders.OrderStatus = '1'))`;

        connection.query(SQL).on('done', (data) => {
            const temdata = data.records || [];
            const dataordenestemp = {};
            const verificar = {};

            if (temdata.length > 0) {
                const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
                temdata.forEach((orden) => {
                    const date = new Date(orden.t);
                    const dtime = date.toLocaleTimeString('en-us', timeOpts);
                    let dtimeout = orden.Lt;
                    if (orden.Lt != null) {
                        dtimeout = new Date(orden.Lt).toLocaleTimeString('en-us', timeOpts);
                    }

                    const item = {
                        MIT: orden.MenuItemText,
                        Q: orden.Quantity,
                        modifi: [],
                        Ct: orden.Ctime,
                        Esta: orden.TransactionStatus,
                        EP: orden.ExtendedPrice
                    };

                    if (orden.TransactionStatus >= 2) {
                        verificar[orden.OrderID] = orden.OrderID;
                    }

                    const auxorden = {
                        oid: orden.OrderID,
                        Lt: dtimeout,
                        St: orden.st,
                        left: '100%',
                        top: 0,
                        time: '',
                        flash: false,
                        t: dtime,
                        Ot: orden.t,
                        Mo: orden.M || 'Kiosk',
                        Ma: orden.DineInTableText || ('Turno #' + (orden.OrderID % 100 === 0 ? 100 : orden.OrderID % 100)),
                        GN: orden.GuestNumber || 1,
                        tid: orden.tid || 0,
                        T: orden.AmountDue,
                        items: []
                    };

                    if (!dataordenestemp[orden.OrderID]) {
                        dataordenestemp[orden.OrderID] = auxorden;
                    }
                    dataordenestemp[orden.OrderID].items.push(item);
                });

                for (const id in dataordenes) {
                    const oldOrden = dataordenes[id];
                    if (oldOrden && dataordenestemp[oldOrden.oid] && dataordenestemp[oldOrden.oid].items.length !== oldOrden.items.length) {
                        ordenesreplace[oldOrden.oid] = dataordenestemp[oldOrden.oid];
                    }
                }

                for (const id in verificar) {
                    if (dataordenestemp[id]) {
                        ordenesreplace[id] = dataordenestemp[id];
                    }
                }

                dataordenes = dataordenestemp;
            }
        }).on('fail', (err) => {
            console.error('pedidomesa query err:', err && err.message);
        });
    } catch (err) {
        console.error('pedidomesa status:', err);
    }
}

function initSettings() {
    // Cargar impuestos
    connection.query("SELECT SalesTaxRate, GSTRate FROM GeneralSettings").on('done', (data) => {
        if (data.records && data.records.length > 0) {
            SalesTaxRate = data.records[0].SalesTaxRate || 0;
            GSTRate = data.records[0].GSTRate || 0;
            console.log(`[Settings] SalesTaxRate: ${SalesTaxRate}, GSTRate: ${GSTRate}`);
        }
    }).on('fail', () => { });

    // Cargar estación
    const hostname = os.hostname();
    connection.query(`SELECT StationID FROM StationSettings WHERE (ComputerName='${hostname}')`).on('done', (data) => {
        if (data.records && data.records.length > 0) {
            stdata = { StationID: data.records[0].StationID || 1 };
        } else {
            connection.query("SELECT TOP 1 StationID FROM StationSettings").on('done', (d2) => {
                if (d2.records && d2.records.length > 0) {
                    stdata = { StationID: d2.records[0].StationID || 1 };
                }
            }).on('fail', () => { });
        }
    }).on('fail', () => { });
}

// Iniciar servidor
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Serviplus POS Server running on port ${PORT}`);
    console.log(`📡 Mirroring KDS & Socket.io activo`);
    console.log(`💳 Wompi Pagos & Recibos Digitales activos`);
    console.log(`====================================================`);

    initSettings();
    pedidomesa();

    // Actualizar periódicamente el visor clásico
    setInterval(pedidomesa, 5000);
});
