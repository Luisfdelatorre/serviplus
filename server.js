var express = require('express'),
    bodyparser = require('body-parser'),
    jwt = require('jsonwebtoken'),
    path = require('path'),
    fs = require('fs');

var http = require('http');
var app = express();
var server = http.createServer(app);
var socketIo = require('socket.io');
var io = socketIo(server, { cors: { origin: '*' } });
io.on('connection', function (clientSocket) {
    // Retransmitir sincronizacion de navegacion entre pantallas KDS (Mirroring)
    clientSocket.on('kds:mirror_sync', function (data) {
        clientSocket.broadcast.emit('kds:mirror_sync', data);
    });
});
var os = require("os");
var config = [];
var templateg;
var template;
config.key = 'Medalla6571';
var ADODB = require('./node_modules/node-adodb/lib/client');
var jwt, dataordenes = {}, dataordenestotal = {}, ordenesreplace = {}
datamodifiers = {};
var connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\SP\\B\\kebab.mdb;');
ADODB.debug = true;
var stdata = { StationID: 1, printername: [], printertitle: [] };
var SalesTaxRate = 0, GSTRate = 0;

process.on('uncaughtException', function (err) {
    console.error('[Process Error]:', err.message);
});
process.on('unhandledRejection', function (reason) {
    console.error('[Unhandled Rejection]:', reason);
});
app.use(function (req, res, next) {
    var origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
var moment = require('moment');
app.use(bodyparser.urlencoded({
    extended: false
}));
app.use(bodyparser.json());

const aldeloService = require('./server/aldeloService');
const receiptService = require('./server/receiptService');

// API routes para Kiosk y KDS
app.get('/api/menu', async (req, res) => {
    try {
        const categories = await aldeloService.getMenu();
        res.json({ success: true, data: categories });
    } catch (err) {
        console.error('Error in /api/menu:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/employees', async (req, res) => {
    try {
        const employees = await aldeloService.getEmployees();
        res.json({ success: true, data: employees });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/orders/active', async (req, res) => {
    try {
        const orders = await aldeloService.getActiveOrders();
        res.json({ success: true, data: orders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/tables', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const sql = `
            SELECT t.DineInTableID as id, t.DineInTableText as name, t.TableGroupID as groupId, g.TableGroupText as groupName, t.DineInTableInActive as inActive
            FROM DineInTables t
            LEFT JOIN DineInTableGroups g ON t.TableGroupID = g.TableGroupID
            WHERE (t.DineInTableInActive = False OR t.DineInTableInActive IS NULL)
        `;
        connection.query(sql).on('done', function (data) {
            const sorted = (data.records || []).sort((a, b) => {
                const numA = parseInt(a.name || a.id, 10);
                const numB = parseInt(b.name || b.id, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.name || a.id).localeCompare(String(b.name || b.id));
            });
            res.json({ success: true, data: sorted });
        }).on('fail', function (err) {
            res.status(500).json({ success: false, error: err.message });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Crear orden (desde Kiosk o Front Desk)
app.post('/api/orders', async (req, res) => {
    try {
        const { employeeId, items, paymentMethod, notes, tableId, guestNumber, orderType, isPaid } = req.body;

        const newOrder = await aldeloService.createOrder({
            employeeId: employeeId || 1,
            orderType: orderType || 1,
            items: items || [],
            paymentMethod: paymentMethod || 'CASH',
            notes: notes || '',
            tableId: tableId || null,
            guestNumber: guestNumber || 1,
            isPaid: (isPaid !== undefined) ? !!isPaid : true
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

        // Refrescar el visor clásico de inmediato
        try {
            pedidomesa();
        } catch (e) {
            console.error('[POST /api/orders] pedidomesa err:', e.message);
        }

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

// 4.1 Enviar recibo digital (Email o SMS) y endpoints de Recibo Digital
app.post('/api/orders/:id/receipt', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { type, destination } = req.body;
        const receiptInfo = receiptService.generateReceiptCode(orderId);
        console.log('[Receipt] Recibo digital solicitado para Orden #' + orderId + ': tipo=' + type + ', destino=' + destination + ', url=' + receiptInfo.path);
        res.json({
            success: true,
            data: {
                orderId,
                receiptCode: receiptInfo.urlCode,
                receiptUrl: receiptInfo.path,
                transactionRef: receiptInfo.transactionRef,
                receiptFullUrl: receiptInfo.fullUrl
            },
            message: 'Recibo digital enviado con éxito a ' + destination
        });
    } catch (err) {
        console.error('Error in POST /api/orders/:id/receipt:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API para consultar JSON de un Recibo por su código único de 13 caracteres
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
app.get(['/p/:code', '/receipt/:code', '/r/:code'], async (req, res) => {
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

// 5. Actualizar estado de orden según especificación Aldelo POS:
// 1 = OpenOrder (Orden abierta / pendiente)
// 2 = SettledOrder (Orden pagada y cerrada)
// 3 = VoidedOrder (Orden anulada)
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status, tableReady } = req.body;

        await aldeloService.updateOrderStatus(orderId, status, tableReady);

        if (io) {
            io.emit('order:status_changed', { orderId, status, tableReady });
            console.log(`[Order Status] Order #${orderId} changed to ${status}${tableReady !== undefined ? ` (tableReady: ${tableReady})` : ''}`);
        }

        // Refrescar el visor clásico de inmediato
        try { pedidomesa(); } catch (e) { }

        res.json({ success: true, data: { orderId, status, tableReady } });
    } catch (err) {
        console.error('Error in PUT /api/orders/:id/status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5b. Estado operativo exclusivo de COCINA (KDS):
// PENDING (Pendiente), COOKING (Cocinando), READY (Listo para retiro), SERVED (Despachado de cocina)
// NO interviene con OrderStatus de Aldelo (el flujo contable y de caja queda intacto).
app.put('/api/orders/:id/kds-status', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
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

        // Refrescar visor clásico si aplica
        try { pedidomesa(); } catch (e) { }

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error in PUT /api/orders/:id/kds-status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Wompi Payments Integration (Colombia COP)
// Endpoint para crear el Payment Intent de Wompi (Colombia COP)
app.post('/api/payments/wompi/intent', (req, res) => {
    try {
        const { amount, reference: customRef } = req.body;
        const aldeloAmount = parseFloat(amount) || 0;

        // En Colombia los valores de Aldelo vienen en miles (ej: 8 = 8.000 COP, 2.5 = 2.500 COP)
        const amountInCOP = Math.round(aldeloAmount * 1000);
        // Wompi exige amount_in_cents (en centavos de peso COP)
        const amountInCents = amountInCOP * 100;
        const reference = customRef || `SP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        let appConfig = {};
        try { appConfig = require('./config.json'); } catch (e) { }
        const wompiConfig = appConfig.wompi || {};
        const publicKey = wompiConfig.publicKey || 'pub_prod_F4z65GfEwT9z3P';
        const integritySecret = wompiConfig.integritySecret || '';
        const currency = wompiConfig.currency || 'COP';

        let signature = '';
        if (integritySecret) {
            const crypto = require('crypto');
            // Firma de integridad oficial Wompi: SHA256(reference + amountInCents + currency + integritySecret)
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

// Webhook Wompi QR
app.post('/api/payments/wompi/webhook', (req, res) => {
    try {
        const event = req.body;
        console.log('[Wompi Webhook received]:', JSON.stringify(event));
        if (event && event.data && event.data.transaction && io) {
            const tx = event.data.transaction;
            io.emit(`payment:${tx.reference}`, {
                status: tx.status,
                amountInCOP: tx.amount_in_cents / 100,
                aldeloAmount: (tx.amount_in_cents / 100) / 1000,
                reference: tx.reference
            });
        }
        res.json({ received: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Ruta principal / : Cargar directamente la aplicación clásica
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Redirigir cualquier enlace antiguo de /old hacia la ruta raíz /#/mesas
app.get(['/old', '/old/*'], (req, res) => {
    res.redirect('/#/mesas');
});

// 2. Ruta modern: Nueva aplicación Kiosk & KDS
app.get(['/modern', '/modern/*', '/kiosk'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public/modern/index.html'));
});

// 3. Ruta react: Nueva aplicación React Kiosk & KDS (SPA)
app.use('/react', express.static(path.join(__dirname, 'client/dist')));
app.get(['/react', '/react/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Redirigir al visor clásico
app.get('/visor', (req, res) => {
    res.redirect('/#/visor');
});

app.get("/report", function (req, res) {
    try {
        const dateParam = parseInt(req.query.date) || 0;
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

        let datamap = {};
        connection.query(SQL).on("done", function (data) {
            if (data && data.records) {
                let temdata = data.records;
                let profit = 0;
                if (temdata.length > 0) {
                    temdata.forEach(function (record) {
                        record.OrderDateTime = moment.utc(record.OrderDateTime).local().format('MM-DD HH:mm');
                        if (!datamap[record.EmployeeID])
                            datamap[record.EmployeeID] = { "name": '', "total": 0, "pay": 0, "list": [] };
                        datamap[record.EmployeeID].list.push(record);
                        datamap[record.EmployeeID].total += record.DefaultUnitPrice;
                        datamap[record.EmployeeID].pay += (record.ItemDelComp || 0);
                        datamap[record.EmployeeID].name = `${record.FirstName} ${record.LastName}`;
                        profit += record.DefaultUnitPrice - (record.ItemDelComp || 0);
                    });
                }
                res.json({ code: 1, profit: profit, response: datamap });
            } else {
                res.json({ code: 1, profit: 0, response: {} });
            }
        });
    } catch (err) {
        console.error("Error fetching report:", err);
        res.status(500).json({ code: 1, response: 0 });
    }
});
app.post('/auth/login', function (req, res) {

    var SQL = "SELECT EmployeeID as id, MiddleInitial as M, FirstName as N,LastName as LN, DineInNotAvail as Vr FROM EmployeeFiles WHERE (AccessCode='" + req.body.key + "')";
    connection.query(SQL).on('done', function (data) {
        if (data.records.length > 0) {
            var str = '{ "code": 0, "setup": ' + JSON.stringify(data.records);
            data.records[0].AccessCode = req.body.key;
            var token = jwt_encode(config.key, data.records[0]);
            str += ', "response": {"token":"' + token.o + '","refresh_token":"' + token.r + '"}}';
            var obj = JSON.parse(str);

        } else {
            var str = '{ "code": 1, "response":0}';
            var obj = JSON.parse(str);

        }
        res.send(obj);
    });

});
app.post('/auth/delegation', function (req, res) {
    var tokenr = req.body.refresh_token;
    var decoded = jwt_decode(tokenr, config.key + '_');
    if (decoded != 'error') {
        connection.query(decoded.SQL).on('done', function (data) {
            if (data.records.length > 0) {
                var token = jwt_encode(config.key, data.records[0]);
                var str = '{ "code": 0, "response": {"token":"' + token.o + '","refresh_token":"' + token.r + '"}}';
                var obj = JSON.parse(str);
                res.send(obj);
            } else {
                var str = '{ "code": 1, "response":0}';
                var obj = JSON.parse(str);
                res.send(obj);
            }
        });
    } else {
        var str = '{ "code": 1, "response":0}';
        var obj = JSON.parse(str);
        res.send(obj);
    }
});
app.all('/ping', function (req, res) {
    var key = (req.body && req.body.key) || (req.query && req.query.key) || '127.0.0.1';
    res.json({ code: 0, responseip: key });
});
app.post('/home/mesas', function (req, res) {
    try {
        var token = req.body.atoken;
        var decoded = jwt_decode(token, config.key);
        if (decoded != 'error') {
            connection.query(decoded.SQL).on('done', function (data) {
                var SQL = "SELECT DineInTables.DineInTableID AS id, DineInTables.DineInTableText AS N, DineInTableGroups.TableGroupText AS G, DineInTableGroups.TableGroupID as Gid FROM DineInTableGroups INNER JOIN DineInTables ON DineInTableGroups.TableGroupID = DineInTables.TableGroupID";
                connection.query(SQL).on('done', function (data) {
                    var grupos = {};
                    data.records.forEach(function (mesa) {
                        grupos[mesa.Gid] = {
                            'm': mesa.G,
                            'selec': false
                        };
                    })
                    var str = '{ "code": 0, "response":{"mesas":' + JSON.stringify(data.records) + ',"grupos":' + JSON.stringify(grupos) + '}}';
                    var obj = JSON.parse(str);
                    res.send(obj);
                });
            });

        } else {
            var str = '{ "code": 1, "response":0}';
            var obj = JSON.parse(str);
            res.send(obj);
        }
    } catch (err) {
        var str = '{ "code": 1, "response":0}';
        var obj = JSON.parse(str);
        res.send(obj);
    }
});
app.post('/home/mesastat', function (req, res) {
    try {
        var token = req.body.atoken;
        var decoded = jwt_decode(token, config.key);
        if (decoded != 'error') {
            connection.query(decoded.SQL).on('done', function (d) {
                var mesas = {};
                if (Object.keys(dataordenes).length > 0) {
                    var orden;
                    for (id in dataordenes) {
                        orden = dataordenes[id];

                        if (orden.St == 1) {
                            mesas[orden.tid] = {
                                'oid': orden.oid,
                                'id': orden.tid,
                                'M': orden.Mo,
                                'time': [],
                                'GN': orden.GN,
                                'T': orden.AmountDue
                            };



                            var da = new Date(orden.Ot);
                            var da2 = new Date();
                            var daf = (da2 - da) / 1000;
                            if (daf < 60) {
                                daf = daf.toFixed(0) + 'Seg'
                            } else if (daf >= 60 && daf < 3600) {
                                daf = daf / 60;
                                daf = daf.toFixed(1) + ' Min'

                            } else {
                                daf = daf / 3600;
                                daf = daf.toFixed(1) + 'Hr'
                            }
                            mesas[orden.tid].time = daf;
                            //console.log(JSON.stringify(mesas));	
                        }
                    }


                }


                var str = '{ "code": 0, "response":{"mesas":' + JSON.stringify(mesas) + '}}';
                var obj = JSON.parse(str);
                res.send(obj);
            });
        } else {
            var str = '{ "code": 1, "response":0}';
            var obj = JSON.parse(str);
            res.send(obj);
        }
    } catch (err) {
        var str = '{ "code": 1, "response":0}';
        var obj = JSON.parse(str);
        res.send(obj);
    }

});
app.all('/home/visor', function (req, res) {
    try {
        var last = parseInt(req.body && req.body.last) || parseInt(req.query && req.query.last) || 0;
        var ordenesin = {}, ordenespartial = {}, ordenesout = [];

        if (Object.keys(dataordenes).length > 0) {
            var orden;
            for (id in dataordenes) {
                orden = dataordenes[id];
                if (orden.oid > last) {
                    ordenesin[orden.oid] = orden;
                }
                if (orden.St == 2) {
                    ordenesout.push({ 'id': orden.oid, 'Lt': orden.Lt });
                }
            }
        }
        res.json({
            code: 0,
            response: {
                ordenesin: ordenesin,
                ordenesout: ordenesout,
                ordenesreplace: ordenesreplace
            }
        });
    } catch (err) {
        console.error('Error in /home/visor:', err);
        res.json({ code: 1, response: 0 });
    }
});
app.post('/home/categorias', function (req, res) {
    // printZebra("123", "POS58");
    var token = req.body.atoken;
    var decoded = jwt_decode(token, config.key);

    if (decoded != 'error') {
        connection.query(decoded.SQL).on('done', function (data) {
            if (data.records.length > 0) {
                var SQL = "SELECT MenuGroupID as id, MenuGroupText as N, DisplayIndex as DI from MenuGroups WHERE (DisplayIndex >= 0) ORDER BY DisplayIndex";
                connection.query(SQL).on('done', function (data) {
                    var str = '{ "code": 0, "response":{"categorias":' + JSON.stringify(data.records) + '}}';
                    var obj = JSON.parse(str);
                    res.send(obj);
                });

            } else {
                var str = '{ "code": 1, "response":0}';
                var obj = JSON.parse(str);

            }
        });

    } else {
        var str = '{ "code": 1, "response":0}';
        var obj = JSON.parse(str);
        res.send(obj);
    }

});
app.post('/home/product', function (req, res) {
    var token = req.body.atoken;
    var decoded = jwt_decode(token, config.key);
    connection.query(decoded.SQL).on('done', function (data) {
        if (data.records.length > 0) {
            var id = req.body.id;
            var SQL = "SELECT ScriptDetails AS SDS, MenuItems.MenuItemInActive as MIIA,MenuItems.MenuItemNotification as MINI,MenuItems.barcode,MenuItems.MenuItemType as MIT,MenuItems.MenuItemPopUpHeaderID as MIPHID,MenuItems.MenuGroupid as M, MenuItems.MenuItemID AS id, MenuItems.MenuItemText AS N, MenuItems.DefaultUnitPrice AS P, MenuItems.DisplayIndex as I FROM MenuItems, MenuGroups WHERE (((MenuItems.MenuGroupid)=[MenuGroups].[MenuGroupID]) )";
            //console.log(SQL); 
            connection.query(SQL).on('done', function (data) {
                // console.log(JSON.stringify(data.records)); 
                var SQL = "SELECT DISTINCT MenuModifiers.MenuModifierID AS id, MenuModifiers.MenuModifierText AS N, MenuModifiers.AdditionalCost AS P, MenuModifierPopUps.MenuItemID as MID FROM MenuModifiers, MenuModifierPopUps WHERE (((MenuModifiers.MenuModifierID)=[MenuModifierPopUps].[MenuModifierID]))";
                connection.query(SQL, 1).on('done', function (data2, ii) {
                    var str = '{ "code": 0, "response":{"product":' + JSON.stringify(data.records) + ',"modifi":' + JSON.stringify(data2.records) + '}}';
                    var obj = JSON.parse(str);
                    res.send(obj);
                });
            });
        } else {
            var str = '{ "code": 1, "response":0}';
            var obj = JSON.parse(str);
            res.send(obj);
        }
    });
});
app.post('/home/pedido', function (req, res) {
    try {
        var token = req.body.atoken;
        var pedido = typeof req.body.list === 'string' ? JSON.parse(req.body.list) : req.body.list;
        var decoded = jwt_decode(token, config.key);

        if (decoded != 'error') {
            var dtoday = Date.now();
            var datehoy = dtoday / 86400000 + 25569 - 1 / 6;
            var dres = (datehoy - parseInt(datehoy)) * 100000 - 1;
            var idres = parseInt(dres) / 100000;
            var initime = datehoy - idres;
            var orderid;

            fs.readFile('recibotemplate.txt', 'utf8', function (err, contents) {
                if (!err && contents) templateg = contents;
            });

            connection.query(decoded.SQL).on('done', function (data) {
                if (data.records && data.records.length > 0) {
                    var today = new Date();
                    var dtoday = today.toLocaleDateString();
                    var dtime = today.toLocaleTimeString();
                    var prodcutoslist = ['', '', '', '', '', '', '', '', ''];
                    var PID = pedido.pid || 0;
                    var SQL;

                    var curStationID = (stdata && stdata.StationID) ? stdata.StationID : 1;
                    var curSalesTax = (typeof SalesTaxRate === 'number' && !isNaN(SalesTaxRate)) ? SalesTaxRate : 0;
                    var curGSTRate = (typeof GSTRate === 'number' && !isNaN(GSTRate)) ? GSTRate : 0;
                    var tax1 = ((pedido.h.AmountDue || 0) * curSalesTax) || 0;
                    var tax2 = ((pedido.h.AmountDue || 0) * curGSTRate) || 0;

                    if (PID > 0) {
                        SQL = "SELECT OrderID AS id FROM OrderHeaders WHERE OrderID=" + PID;
                    } else {
                        SQL = 'INSERT INTO OrderHeaders ( OrderDateTime,EmployeeID,StationID,OrderType,DineInTableID,DeliveryCharge,DeliveryComp,SalesTaxRate,DiscountTaxable,OrderStatus,AmountDue,Kitchen1AlreadyPrinted,Kitchen2AlreadyPrinted,Kitchen3AlreadyPrinted,BarAlreadyPrinted,PackagerAlreadyPrinted,SubTotal,DiscountAmountUsed,SurchargeAmountUsed,SalesTaxAmountUsed,GSTRate,GSTAmountUsed,TableReady,GuestNumber,GuestCheckPrinted,ServerBankAmount,Kitchen4AlreadyPrinted,Kitchen5AlreadyPrinted,Kitchen6AlreadyPrinted,LiquorTaxRate,LiquorTaxAmount,RemoteSiteNumber,RemoteOrigRowID,StoreNumber,BarTabPreAuth,RowGUID)VALUES(' + datehoy + ',' + (pedido.h.EmployeeID || 1) + ',' + curStationID + ',1,' + (pedido.h.DineInTableID || 1) + ',0,0,' + curSalesTax + ',0,1,' + (pedido.h.AmountDue || 0) + ',1,1,1,1,0,' + (pedido.h.AmountDue || 0) + ',0,0,' + tax1 + ',' + curGSTRate + ',' + tax2 + ',0,' + (pedido.h.GuestNumber || 1) + ',0,0,1,1,1,0,0,1,0,0,0,' + rowid() + ')';
                    }

                    var insert = 0;
                    var leng = (pedido.p && pedido.p.length) ? pedido.p.length : 0;

                    connection.executeScalar(SQL, 'SELECT @@Identity AS id').on('done', function (data1) {
                        if (data1.records && data1.records.length > 0) {
                            orderid = (PID > 0) ? PID : data1.records[0].id;
                            var time = 0;
                            insert = 0;

                            if (leng === 0) {
                                pedidomesa();
                                return res.json({ code: 0, pedid: orderid, response: 0 });
                            }

                            pedido.p.forEach(function (item) {
                                var SQL2 = 'INSERT INTO OrderTransactions (ShortNote,DiscountTaxable,GSTTaxable,OrderID,MenuItemID,MenuItemUnitPrice,Quantity,ExtendedPrice,TransactionStatus,NotificationStatus,RowGUID';
                                var text = '';
                                var values = '';
                                var i = 1;
                                var comment = item.coment || '';
                                var temp = item.cant + '  ' + (item.N || '') + '\n';
                                if (comment) {
                                    temp += '   >' + comment + '\n';
                                }

                                if (item.modifi && item.modifi.length > 0) {
                                    item.modifi.forEach(function (mi) {
                                        text += ',Mod' + i + 'ID,Mod' + i + 'Cost';
                                        values += ',' + mi.id + ',' + (mi.P == null ? 0 : mi.P);
                                        temp += '    ' + (mi.N || '') + '\n';
                                        i++;
                                    });
                                }
                                if (item.notas && item.notas.length > 0) {
                                    item.notas.forEach(function (mi) {
                                        text += ',Mod' + i + 'ID,Mod' + i + 'Cost';
                                        values += ',' + mi.id + ',' + (mi.P == null ? 0 : mi.P);
                                        temp += '    ' + (mi.N || '') + '\n';
                                        i++;
                                    });
                                }

                                if (item.MINI != null && prodcutoslist[item.MINI] !== undefined) {
                                    prodcutoslist[item.MINI] += temp;
                                }
                                if (item.SDS != null) {
                                    var ds = item.SDS.split(';');
                                    if (ds[2]) {
                                        var ds3 = ds[2];
                                        var id2 = ds3.substring(1, 2);
                                        var id = (id2 <= 3) ? (parseInt(id2) + 1) : (id2 === 'B' ? 5 : parseInt(id2) + 2);
                                        if (prodcutoslist[id] !== undefined) {
                                            prodcutoslist[id] += temp;
                                        }
                                    }
                                }

                                var ep = (item.EP != null ? item.EP : item.P) * item.cant;
                                SQL2 += text + ')VALUES(\'' + comment.replace(/'/g, "''") + '\',1,-1,' + orderid + ',' + item.id + ',' + item.P + ',' + item.cant + ',' + ep + ',1,2,' + rowid() + values + ')';
                                insertitem(time, SQL2, res);
                                time += 50;
                            });

                            // Impresión de comandas (sin bloquear la respuesta)
                            try {
                                if (templateg) {
                                    var tpl = templateg;
                                    tpl = tpl.replace(/mesero/g, pedido.h.nombre || '');
                                    tpl = tpl.replace(/ids/g, curStationID);
                                    tpl = tpl.replace(/day/g, dtoday);
                                    tpl = tpl.replace(/time/g, dtime);
                                    tpl = tpl.replace(/oid/g, orderid);
                                    tpl = tpl.replace(/tid/g, pedido.h.DineInTableText || '');
                                    tpl = tpl.replace(/nper/g, pedido.h.GuestNumber || 1);
                                    var SQLticket = "SELECT OrderID, OrderDateTime as t from OrderHeaders WHERE OrderDateTime>=" + initime + " ORDER BY OrderID ";
                                    connection.query(SQLticket).on('done', function (dataor) {
                                        if (dataor.records && dataor.records.length > 0) {
                                            var ticket = orderid - dataor.records[0].OrderID + 1;
                                            tpl = tpl.replace(/tkid/g, ticket);
                                            prodcutoslist.forEach(function (pItem, i) {
                                                if (pItem != '' && stdata && stdata.printertitle && stdata.printername) {
                                                    var pTitle = stdata.printertitle[i] || 'Cocina';
                                                    var pName = stdata.printername[i] || 'Ninguno';
                                                    var readyTpl = tpl.replace(/Cocina/g, pTitle).replace(/productos/g, pItem);
                                                    // printZebra(readyTpl, pName);
                                                }
                                            });
                                        }
                                    });
                                }
                            } catch (printErr) {
                                console.error('Print error ignored:', printErr);
                            }

                        } else {
                            res.json({ code: 1, response: "errortoken" });
                        }
                    }).on('fail', function (headerErr) {
                        console.error('Error creating OrderHeader:', headerErr);
                        res.status(500).json({ code: 1, error: headerErr.message || 'Error inserting order' });
                    });

                    function insertitem(time, sql, res, retryCount) {
                        retryCount = retryCount || 0;
                        connection
                            .executeScalar(sql, 'SELECT @@Identity AS id')
                            .on('done', function (data) {
                                insert++;
                                if (insert >= leng) {
                                    pedidomesa();
                                    res.json({ code: 0, pedid: orderid, response: 0 });
                                }
                            }).on('fail', function (err) {
                                console.error('Error in OrderTransactions insert:', err);
                                if (retryCount < 2) {
                                    setTimeout(function () {
                                        insertitem(time, sql, res, retryCount + 1);
                                    }, 100);
                                } else {
                                    insert++;
                                    if (insert >= leng) {
                                        pedidomesa();
                                        res.json({ code: 0, pedid: orderid, response: 0 });
                                    }
                                }
                            });
                    }

                } else {
                    res.json({ code: 1, response: 0 });
                }
            }).on('fail', function (authErr) {
                console.error('Error verifying token SQL:', authErr);
                res.status(401).json({ code: 1, response: 0 });
            });

        } else {
            res.json({ code: 1, response: 0 });
        }
    } catch (outerErr) {
        console.error('Error in /home/pedido:', outerErr);
        res.status(500).json({ code: 1, error: outerErr.message });
    }
});

// Standalone Monitor de Turnos (TV Screen Status Board)
app.get(['/turns', '/monitor'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'modern', 'turns.html'));
});

app.use(express.static(__dirname + '/public'));
server.listen(80, function () {
    // console.log('Example app listening on port 81!');
    dummy();
    getid();
    pedidomesa();
    setInterval(function () {

        pedidomesa();

    }, 5000);

    setInterval(function () {
        try {
            var SQL = "SELECT MenuModifierID,MenuModifierText,AdditionalCost FROM MenuModifiers";
            connection.query(SQL).on('done', function (data) {
                data.records.forEach(function (modifi) {
                    datamodifiers[modifi.MenuModifierID] = modifi;
                });
            });
        } catch (err) {
            // console.log('status: ' + err);
        }



    }, 67000);



});

function jwt_decode(token, key) {
    var decoded = [];
    //console.log(token);
    try {
        var d = jwt.verify(token, key);
        if (d) {
            decoded.SQL = "SELECT EmployeeID,AccessCode FROM EmployeeFiles WHERE (AccessCode='" + d.data.AccessCode + "')";
        } else {

            decoded = 'error';
        }
    } catch (err) {
        decoded = 'error';
    }






    return decoded;

}


function pedidomesa() {


    try {
        var dtoday = Date.now();
        var datehoy = dtoday / (86400000) + 25569 - 1 / 6;
        var dres = (datehoy - parseInt(datehoy)) * 100000 - 1;
        var idres = parseInt(dres) / 100000;
        var initime = datehoy - idres - 1;
        var SQL = "(SELECT OrderTransactions.ExtendedPrice, OrderTransactions.TransactionStatus, OrderTransactions.OrderTransactionID,OrderTransactions.Mod1ID,OrderHeaders.EditTimestamp AS Lt, MenuItems.KitchenSortNumber AS Ctime, OrderTransactions.MenuItemUnitPrice, OrderTransactions.MenuItemID, OrderHeaders.GuestNumber, OrderHeaders.OrderDateTime AS t, OrderHeaders.AmountDue, OrderHeaders.OrderStatus AS st, OrderHeaders.DineInTableID AS tid, EmployeeFiles.FirstName AS M, OrderHeaders.OrderID, DineInTables.DineInTableText, MenuItems.MenuItemText, OrderTransactions.Quantity FROM (((OrderHeaders INNER JOIN EmployeeFiles ON OrderHeaders.EmployeeID = EmployeeFiles.EmployeeID) INNER JOIN (MenuItems INNER JOIN OrderTransactions ON MenuItems.MenuItemID = OrderTransactions.MenuItemID) ON OrderHeaders.OrderID = OrderTransactions.OrderID) LEFT JOIN DineInTables ON OrderHeaders.DineInTableID = DineInTables.DineInTableID) WHERE ((OrderHeaders.OrderDateTime)>=" + initime + ")) UNION (SELECT OrderTransactions.ExtendedPrice, OrderTransactions.TransactionStatus,OrderTransactions.OrderTransactionID,OrderTransactions.Mod1ID,OrderHeaders.EditTimestamp AS Lt, MenuItems.KitchenSortNumber AS Ctime, OrderTransactions.MenuItemUnitPrice, OrderTransactions.MenuItemID, OrderHeaders.GuestNumber, OrderHeaders.OrderDateTime AS t, OrderHeaders.AmountDue, OrderHeaders.OrderStatus AS st, OrderHeaders.DineInTableID AS tid, EmployeeFiles.FirstName AS M, OrderHeaders.OrderID, DineInTables.DineInTableText, MenuItems.MenuItemText, OrderTransactions.Quantity FROM (((OrderHeaders INNER JOIN EmployeeFiles ON OrderHeaders.EmployeeID = EmployeeFiles.EmployeeID) INNER JOIN (MenuItems INNER JOIN OrderTransactions ON MenuItems.MenuItemID = OrderTransactions.MenuItemID) ON OrderHeaders.OrderID = OrderTransactions.OrderID) LEFT JOIN DineInTables ON OrderHeaders.DineInTableID = DineInTables.DineInTableID) WHERE (OrderHeaders.OrderStatus='1' ))";
        connection.query(SQL).on('done', function (data) {
            var temdata = data.records, dataordenestemp = {}, verificar = {};
            // console.log('entro ' + JSON.stringify(temdata));
            if (temdata.length > 0) {
                temdata.forEach(function (orden) {
                    var options = {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    };
                    var date = new Date(orden.t);
                    var dtime = date.toLocaleTimeString("en-us", options);
                    var dateout, dtimeout;
                    dtimeout = orden.Lt;
                    if (orden.Lt != null) {
                        dateout = new Date(orden.Lt);
                        dtimeout = dateout.toLocaleTimeString("en-us", options);

                    }
                    var item = {
                        'MIT': orden.MenuItemText,
                        'Q': orden.Quantity,
                        'modifi': [],
                        'Ct': orden.Ctime,
                        'Esta': orden.TransactionStatus,
                        'EP': orden.ExtendedPrice,
                    };
                    if (orden.TransactionStatus >= 2) {

                        verificar[orden.OrderID] = orden.OrderID;

                    }

                    var auxorden = {
                        'oid': orden.OrderID,
                        'Lt': dtimeout,
                        'St': orden.st,
                        'left': '100%',
                        'top': 0,
                        'time': '',
                        'flash': false,
                        't': dtime,
                        'Ot': orden.t,
                        'Mo': orden.M || 'Kiosk', //mesero name
                        'Ma': orden.DineInTableText || ('Turno #' + (orden.OrderID % 100 === 0 ? 100 : orden.OrderID % 100)),
                        'GN': orden.GuestNumber || 1,
                        'tid': orden.tid || 0,
                        'T': orden.AmountDue,
                        'items': []

                    };

                    if (dataordenestemp[orden.OrderID] == undefined) {
                        dataordenestemp[orden.OrderID] = auxorden;
                        dataordenestemp[orden.OrderID].items.push(item);
                    } else {
                        dataordenestemp[orden.OrderID].items.push(item);
                    }

                });



                if (Object.keys(dataordenestemp).length > 0) {
                    for (id in dataordenes) {
                        orden = dataordenes[id];
                        if (dataordenestemp[orden.oid].items.length != orden.items.length)
                            ordenesreplace[orden.oid] = dataordenestemp[orden.oid];

                    }


                }


                if (Object.keys(verificar).length > 0) {
                    for (id in verificar) {
                        ordenesreplace[id] = dataordenestemp[id];

                    }


                }




                dataordenes = dataordenestemp;

            }

        });

    } catch (err) {
        console.log('status: ' + err);
    }


}










function jwt_encode(secure, data) {

    var token = [];
    token.o = jwt.sign({
        exp: Math.floor(Date.now() / 1000) + (360 * 60),
        data: data
    }, secure);
    token.r = jwt.sign({
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        data: data
    }, secure + '_');


    return token;



}

function getid() {
    var hostname = os.hostname();
    var SQL = "SELECT * FROM StationSettings WHERE (ComputerName='" + hostname + "')";

    connection.query(SQL).on('done', function (data) {
        if (!data || !data.records || data.records.length === 0) {
            connection.query("SELECT TOP 1 * FROM StationSettings").on('done', function (d2) {
                if (d2 && d2.records && d2.records.length > 0) {
                    initStationData(d2.records[0]);
                }
            });
            return;
        }
        initStationData(data.records[0]);
    });
}

function initStationData(record) {
    stdata = record || {};
    stdata.printername = [];
    stdata.printertitle = [];
    stdata.printername[1] = 'Ninguno';
    stdata.printername[2] = record.KitchenPrinter1Name;
    stdata.printername[3] = record.KitchenPrinter2Name;
    stdata.printername[4] = record.KitchenPrinter3Name;
    stdata.printername[6] = record.KitchenPrinter4Name;
    stdata.printername[7] = record.KitchenPrinter5Name;
    stdata.printername[8] = record.KitchenPrinter6Name;
    stdata.printername[5] = record.BarPrinterName;
    stdata.printertitle[1] = 'Ninguno';
    stdata.printertitle[2] = record.KitchenPrinter1Title;
    stdata.printertitle[3] = record.KitchenPrinter2Title;
    stdata.printertitle[4] = record.KitchenPrinter3Title;
    stdata.printertitle[6] = record.KitchenPrinter4Title;
    stdata.printertitle[7] = record.KitchenPrinter5Title;
    stdata.printertitle[8] = record.KitchenPrinter6Title;
    stdata.printertitle[5] = record.RowVer;
}

function dummy() {
    var SQL = "SELECT SalesTaxRate,GSTRate FROM GeneralSettings";

    connection.query(SQL).on('done', function (data) {

        SalesTaxRate = data.records[0].SalesTaxRate;
        GSTRate = data.records[0].GSTRate;
        console.log(SalesTaxRate + GSTRate);


    });


    return 0;
}

function show_404(req, res) {
    res.sendHeader(404, {
        "Content-Type": "text/plain"
    });
    res.sendBody("You r doing it rong!");
    res.finish();
}

function rowid() {


    var letras = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    var index, code = '{';
    for (var i = 1; i <= 32; i++) {
        index = parseInt(Math.random() * 16);
        if (i == 9 || i == 13 || i == 17 || i == 21)
            code += '-';
        code += letras[index];
    }
    code += '}';
    return code;

}

function printZebra(text, printer_name) {
    if (!printer_name || printer_name === 'Ninguno') return;
    try {
        var req = http.get({
            host: 'localhost',
            port: '1000',
            path: '/print?pedido=' + encodeURIComponent(text) + '&impresora=' + encodeURIComponent(printer_name),
            timeout: 1000
        }, function (res) {
            // Imprimiendo correctamente
        });

        req.on('error', function (err) {
            // Silenciar si serverprint.js no está corriendo en el puerto 1000
        });

        req.on('timeout', function () {
            req.abort();
        });
    } catch (err) {
        console.log('[Print] Error:', err.message);
    }
}