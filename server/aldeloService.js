const ADODB = require('node-adodb');
const config = require('../config.json');
const kdsStore = require('./kdsStore');
const receiptService = require('./receiptService');

function formatAdodbError(err, sql = '') {
  let realMsg = err.message;
  if (err && err.process) {
    try {
      const parsed = typeof err.process === 'string' ? JSON.parse(err.process) : err.process;
      if (parsed && parsed.message) {
        realMsg = parsed.message;
      }
    } catch (_) {
      realMsg = String(err.process);
    }
  }
  const cleanError = new Error(realMsg);
  cleanError.code = err.code;
  cleanError.process = err.process;
  cleanError.sql = sql;
  return cleanError;
}

function wrapAdodb(conn) {
  return {
    async query(sql) {
      try {
        return await conn.query(sql);
      } catch (err) {
        throw formatAdodbError(err, sql);
      }
    },
    async execute(sql, scalar) {
      try {
        return await conn.execute(sql, scalar);
      } catch (err) {
        throw formatAdodbError(err, sql);
      }
    },
    async schema(type, criteria, id) {
      try {
        return await conn.schema(type, criteria, id);
      } catch (err) {
        throw formatAdodbError(err);
      }
    }
  };
}

const defaultDbPath = 'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\SP\\B\\kebab.mdb;';
const connectionString = (config.db && config.db.connectionString) || defaultDbPath;
const rawConnection = ADODB.open(connectionString);
const connection = wrapAdodb(rawConnection);

// Conexión dedicada para productos (C:\SP\B\k.mdb)
const productsConnectionString = (config.db && (config.db.productsConnectionString || config.db.connectionString)) || defaultDbPath;
const productsConnection = (productsConnectionString === connectionString)
  ? connection
  : wrapAdodb(ADODB.open(productsConnectionString));

function generateGUID() {
  const chars = '0123456789ABCDEF';
  let guid = '{';
  for (let i = 1; i <= 32; i++) {
    const idx = Math.floor(Math.random() * 16);
    if (i === 9 || i === 13 || i === 17 || i === 21) guid += '-';
    guid += chars[idx];
  }
  guid += '}';
  return guid;
}

// Convert standard JS date to OleAutomation / Access date number
function getAccessDate(d = new Date()) {
  const startDate = new Date(1899, 11, 30); // Access epoch is 1899-12-30
  const msInDay = 86400000;
  return (d.getTime() - startDate.getTime()) / msInDay;
}

const aldeloService = {
  // 1. Obtener menú con grupos (categorías visibles de Aldelo) y precios
  async getMenu() {
    const sql = `
      SELECT 
        m.MenuItemID as id, 
        IIF(g.MenuGroupID IS NOT NULL, g.MenuGroupID, m.MenuCategoryID) as categoryId, 
        IIF(g.MenuGroupText IS NOT NULL, g.MenuGroupText, 'General') as categoryName, 
        IIF(g.DisplayIndex IS NOT NULL, g.DisplayIndex, 999) as groupOrder,
        m.MenuItemText as name, 
        m.DefaultUnitPrice as price, 
        m.ItemDelComp as commission,
        m.MenuItemDescription as description,
        m.DisplayIndex as itemOrder
      FROM MenuItems m
      LEFT JOIN MenuGroups g ON m.MenuGroupID = g.MenuGroupID
      WHERE m.DefaultUnitPrice > 0
        AND (m.MenuItemInActive IS NULL OR m.MenuItemInActive = 0 OR m.MenuItemInActive = False)
        AND (g.MenuGroupInActive IS NULL OR g.MenuGroupInActive = 0 OR g.MenuGroupInActive = False)
      ORDER BY IIF(g.DisplayIndex IS NOT NULL, g.DisplayIndex, 999), g.MenuGroupText, m.DisplayIndex, m.MenuItemText
    `;
    const items = await productsConnection.query(sql);

    // Obtener modificadores activos asociados a cada producto desde MenuModifierPopUps y MenuModifiers
    const modSql = `
      SELECT DISTINCT 
        m.MenuModifierID AS id, 
        m.MenuModifierText AS name, 
        m.AdditionalCost AS price, 
        p.MenuItemID AS menuItemId,
        IIF(p.PopUpSequenceOrder IS NOT NULL, p.PopUpSequenceOrder, 1) as groupOrder
      FROM MenuModifiers m
      INNER JOIN MenuModifierPopUps p ON m.MenuModifierID = p.MenuModifierID
      WHERE (m.MenuModifierInActive IS NULL OR m.MenuModifierInActive = 0 OR m.MenuModifierInActive = False)
      ORDER BY p.MenuItemID, IIF(p.PopUpSequenceOrder IS NOT NULL, p.PopUpSequenceOrder, 1), m.MenuModifierText
    `;
    let modifiers = [];
    try {
      modifiers = await productsConnection.query(modSql);
    } catch (modErr) {
      console.error('[aldeloService.getMenu] Error fetching modifiers:', modErr.message);
    }

    const modifiersByItem = {};
    (modifiers || []).forEach(mod => {
      if (!modifiersByItem[mod.menuItemId]) {
        modifiersByItem[mod.menuItemId] = [];
      }
      if (!modifiersByItem[mod.menuItemId].some(m => m.id === mod.id)) {
        modifiersByItem[mod.menuItemId].push({
          id: mod.id,
          name: mod.name,
          price: mod.price != null ? Number(Number(mod.price).toFixed(2)) : 0,
          groupOrder: mod.groupOrder || 1
        });
      }
    });

    // Agrupar por grupo/categoría respetando el DisplayIndex de Aldelo
    const categoriesMap = {};
    items.forEach((item) => {
      const catName = item.categoryName || 'General';
      if (!categoriesMap[catName]) {
        categoriesMap[catName] = {
          id: item.categoryId || 0,
          name: catName,
          order: item.groupOrder !== undefined ? item.groupOrder : 999,
          items: []
        };
      }

      let prepTime = 10;
      if (item.description) {
        const match = String(item.description).match(/PREP_TIME\s*=\s*(\d+)/i);
        if (match) prepTime = parseInt(match[1], 10);
      }

      const itemMods = modifiersByItem[item.id] || [];

      categoriesMap[catName].items.push({
        id: item.id,
        name: item.name,
        price: Number(item.price.toFixed(2)),
        commission: item.commission ? Number(item.commission.toFixed(2)) : 0,
        prepTime: prepTime,
        description: item.description || '',
        modifiers: itemMods,
        hasModifiers: itemMods.length > 0
      });
    });

    return Object.values(categoriesMap).sort((a, b) => a.order - b.order);
  },

  // 2. Obtener lista de empleados
  async getEmployees() {
    const sql = `
      SELECT EmployeeID as id, FirstName as firstName, LastName as lastName, AccessCode as pin
      FROM EmployeeFiles
      ORDER BY FirstName, LastName
    `;
    return await connection.query(sql);
  },

  // 2b. Verificar acceso de administrador / gerente (SecurityLevel <= 2)
  async verifyAdminAccess(accessCode) {
    if (!accessCode) return { success: false, error: 'Código de acceso requerido' };
    const cleanPin = String(accessCode).trim().replace(/'/g, "''");
    const sql = `
      SELECT EmployeeID as id, FirstName as firstName, LastName as lastName, SecurityLevel as securityLevel
      FROM EmployeeFiles
      WHERE (AccessCode = '${cleanPin}')
      AND (EmployeeInActive = False OR EmployeeInActive IS NULL)
    `;
    const records = await connection.query(sql);
    if (!records || records.length === 0) {
      return { success: false, error: 'Código de empleado no encontrado o inactivo' };
    }
    const emp = records[0];
    const secLevel = parseInt(emp.securityLevel, 10);
    // SecurityLevel 1 (Admin) o 2 (Manager)
    if (isNaN(secLevel) || secLevel > 2) {
      return {
        success: false,
        error: `Acceso denegado: El empleado ${emp.firstName} no tiene nivel administrativo (Nivel actual: ${emp.securityLevel || 'desconocido'})`
      };
    }
    return {
      success: true,
      employee: {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName || ''}`.trim(),
        securityLevel: secLevel
      }
    };
  },

  // 3. Obtener órdenes activas (para KDS y pantalla de turnos)
  async getActiveOrders() {
    // Traer empleados para mapeo en memoria rápido
    const employees = await this.getEmployees();
    const empMap = {};
    employees.forEach(e => {
      empMap[e.id] = `${e.firstName} ${e.lastName || ''}`.trim();
    });

    const sqlHeaders = `
      SELECT TOP 100
        h.OrderID, 
        h.OrderDateTime, 
        h.OrderType,
        h.OrderStatus, 
        h.AmountDue, 
        h.GuestNumber,
        h.DineInTableID,
        tbl.DineInTableText,
        h.EmployeeID,
        h.TableReady,
        h.PackagerAlreadyPrinted
      FROM OrderHeaders h
      LEFT JOIN DineInTables tbl ON h.DineInTableID = tbl.DineInTableID
      ORDER BY h.OrderID DESC
    `;
    const orders = await connection.query(sqlHeaders);

    if (!orders || orders.length === 0) return [];

    // Traer ítems de las órdenes con identificadores de modificadores
    const orderIds = orders.slice(0, 60).map((o) => o.OrderID).join(',');
    const sqlItems = `
      SELECT 
        t.OrderTransactionID, 
        t.OrderID, 
        t.MenuItemID, 
        t.MenuItemUnitPrice, 
        t.Quantity, 
        t.ExtendedPrice,
        t.ShortNote,
        t.Mod1ID, t.Mod1Cost,
        t.Mod2ID, t.Mod2Cost,
        t.Mod3ID, t.Mod3Cost,
        t.Mod4ID, t.Mod4Cost,
        t.Mod5ID, t.Mod5Cost,
        m.MenuItemText,
        m.MenuItemDescription
      FROM OrderTransactions t
      LEFT JOIN MenuItems m ON t.MenuItemID = m.MenuItemID
      WHERE t.OrderID IN (${orderIds})
    `;
    const items = await connection.query(sqlItems);

    let modMap = {};
    try {
      const allMods = await productsConnection.query('SELECT MenuModifierID as id, MenuModifierText as name FROM MenuModifiers');
      (allMods || []).forEach(m => { modMap[m.id] = m.name; });
    } catch (mErr) {
      console.error('[aldeloService.getActiveOrders] Error loading MenuModifiers:', mErr.message);
    }

    const itemsByOrder = {};
    items.forEach((item) => {
      if (!itemsByOrder[item.OrderID]) itemsByOrder[item.OrderID] = [];

      let itemPrepTime = 10;
      if (item.MenuItemDescription) {
        const match = String(item.MenuItemDescription).match(/PREP_TIME\s*=\s*(\d+)/i);
        if (match) itemPrepTime = parseInt(match[1], 10);
      }

      const itemMods = [];
      for (let i = 1; i <= 5; i++) {
        const mId = item[`Mod${i}ID`];
        if (mId && modMap[mId]) {
          itemMods.push({
            id: mId,
            name: modMap[mId],
            cost: item[`Mod${i}Cost`] || 0
          });
        }
      }

      itemsByOrder[item.OrderID].push({
        id: item.OrderTransactionID,
        menuItemId: item.MenuItemID,
        name: item.MenuItemText,
        unitPrice: item.MenuItemUnitPrice,
        quantity: item.Quantity,
        extendedPrice: item.ExtendedPrice,
        notes: item.ShortNote || '',
        modifiers: itemMods,
        prepTime: itemPrepTime
      });
    });

    return orders.map((order) => {
      const isDbServed = !!order.PackagerAlreadyPrinted;
      const kdsInfo = kdsStore.getKdsState(order.OrderID, !!order.TableReady, isDbServed);
      const effectiveKdsStatus = isDbServed ? kdsStore.KDS_STATUSES.SERVED : kdsInfo.kdsStatus;

      const orderItems = itemsByOrder[order.OrderID] || [];
      const prepTimes = orderItems.map(it => it.prepTime || 10);
      const maxPrepTime = prepTimes.length > 0 ? Math.max(...prepTimes) : 10;

      return {
        id: order.OrderID,
        orderNumber: (order.OrderID % 100) || 100,
        createdAt: order.OrderDateTime,
        status: order.OrderStatus || '1', // Aldelo POS: 1=OpenOrder, 2=SettledOrder, 3=VoidedOrder
        isPaid: order.OrderStatus === '2',
        tableReady: !isDbServed && !!order.TableReady,
        packagerPrinted: isDbServed,
        kdsStatus: effectiveKdsStatus, // KDS Cocina: PREPARING, READY, SERVED
        kdsItemChecks: kdsInfo.itemChecks || {},
        kdsUpdatedAt: kdsInfo.updatedAt,
        total: order.AmountDue,
        guestNumber: order.GuestNumber,
        orderType: Number(order.OrderType) || 1,
        tableId: (Number(order.OrderType) === 1 && order.DineInTableID) ? (order.DineInTableText || String(order.DineInTableID)) : null,
        isTakeOut: Number(order.OrderType) === 2 || !order.DineInTableID,
        serverName: empMap[order.EmployeeID] || 'Caja / Kiosk',
        prepTime: maxPrepTime,
        maxPrepTime: maxPrepTime,
        items: orderItems
      };
    });
  },

  // 4. Crear una nueva orden (desde Kiosk o Front Desk)
  // Nota: Las órdenes de Kiosk se crean con isPaid = true porque el pago se recibe previamente.
  async createOrder({ employeeId = 1, orderType = 1, items = [], tableId = null, guestNumber = 1, notes = '', paymentMethod = 'CASH', isPaid = true }) {
    if (!items || items.length === 0) {
      throw new Error('La orden debe contener al menos un producto.');
    }

    // Calcular monto total sumando precios de ítems y sus modificadores
    let calculatedTotal = 0;
    for (const item of items) {
      const qty = item.quantity || 1;
      const basePrice = Number(item.basePrice !== undefined ? item.basePrice : item.price) || 0;
      const itemModifiers = Array.isArray(item.modifiers) ? item.modifiers : (Array.isArray(item.modifi) ? item.modifi : []);
      const modCostSum = itemModifiers.reduce((acc, m) => acc + (Number(m.price || m.P) || 0), 0);
      calculatedTotal += (basePrice + modCostSum) * qty;
    }
    const totalAmount = Number(calculatedTotal.toFixed(2));
    const accessDate = getAccessDate(new Date());
    const rowGuid = generateGUID();
    const initialOrderStatus = isPaid ? '2' : '1'; // 2 = SettledOrder (Pagada), 1 = OpenOrder (Pendiente de pago)
    let resolvedTableId = null;
    // En Aldelo POS, las órdenes para llevar (OrderType = 2) no tienen mesa (DineInTableID = NULL)
    if (orderType === 1 && tableId) {
      const tableNum = parseInt(tableId);
      if (!isNaN(tableNum) && tableNum > 0) {
        try {
          const match = await connection.query(`SELECT TOP 1 DineInTableID FROM DineInTables WHERE DineInTableID = ${tableNum} OR DineInTableText = '${tableId}'`);
          if (match && match.length > 0) {
            resolvedTableId = match[0].DineInTableID;
          } else {
            const g = generateGUID();
            await connection.execute(`INSERT INTO DineInTables (DineInTableText, TableGroupID, DisplayIndex, RowGUID) VALUES ('${tableId}', 1, ${tableNum}, '${g}')`);
            const created = await connection.query(`SELECT TOP 1 DineInTableID FROM DineInTables WHERE DineInTableText = '${tableId}'`);
            if (created && created.length > 0) {
              resolvedTableId = created[0].DineInTableID;
            }
          }
        } catch (tErr) {
          console.error('[Table Resolution]', tErr.message);
          resolvedTableId = tableNum;
        }
      }
    }

    const tableValue = (orderType === 1 && resolvedTableId) ? resolvedTableId : 'NULL';

    const sqlHeader = `
      INSERT INTO OrderHeaders (
        OrderDateTime, EmployeeID, StationID, OrderType, DineInTableID, 
        DeliveryCharge, DeliveryComp, SalesTaxRate, DiscountTaxable, OrderStatus, 
        AmountDue, Kitchen1AlreadyPrinted, Kitchen2AlreadyPrinted, Kitchen3AlreadyPrinted, 
        BarAlreadyPrinted, PackagerAlreadyPrinted, SubTotal, DiscountAmountUsed, 
        SurchargeAmountUsed, SalesTaxAmountUsed, GSTRate, GSTAmountUsed, TableReady, 
        GuestNumber, GuestCheckPrinted, ServerBankAmount, Kitchen4AlreadyPrinted, 
        Kitchen5AlreadyPrinted, Kitchen6AlreadyPrinted, LiquorTaxRate, LiquorTaxAmount, 
        RemoteSiteNumber, RemoteOrigRowID, StoreNumber, BarTabPreAuth, RowGUID
      ) VALUES (
        ${accessDate}, ${employeeId}, 1, ${orderType}, ${tableValue}, 
        0, 0, 0, 0, '${initialOrderStatus}', 
        ${totalAmount}, 1, 1, 1, 
        1, 0, ${totalAmount}, 0, 
        0, 0, 0, 0, 0, 
        ${guestNumber || 1}, 0, 0, 1, 
        1, 1, 0, 0, 
        1, 0, 0, 0, '${rowGuid}'
      )
    `;

    // Insertar encabezado y recuperar el OrderID autoincremental
    const result = await connection.execute(sqlHeader, 'SELECT @@Identity AS id');
    const orderId = result && result.length > 0 ? result[0].id : null;

    if (!orderId) {
      throw new Error('No se pudo obtener el identificador de la nueva orden.');
    }

    // Insertar cada ítem en OrderTransactions soportando modificadores de Aldelo (Mod1ID...Mod20ID)
    for (const item of items) {
      const menuItemId = parseInt(item.id || item.menuItemId, 10);
      if (isNaN(menuItemId) || menuItemId <= 0) continue;

      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const basePrice = Number(item.basePrice !== undefined ? item.basePrice : item.price) || 0;
      const itemModifiers = Array.isArray(item.modifiers) ? item.modifiers : (Array.isArray(item.modifi) ? item.modifi : []);
      const modCostSum = itemModifiers.reduce((acc, m) => acc + (Number(m.price || m.P) || 0), 0);
      const unitPriceWithMods = basePrice + modCostSum;
      const extendedPrice = unitPriceWithMods * qty;

      let modCols = '';
      let modVals = '';
      let modNames = [];
      let modSlot = 1;

      itemModifiers.forEach((mod) => {
        const rawModId = mod.id || mod.MenuModifierID;
        const numericModId = parseInt(rawModId, 10);
        const modCost = Number(mod.price || mod.P || 0) || 0;
        const modName = mod.name || mod.N || mod.MenuModifierText || '';

        // Solo IDs numéricos reales pueden ir a los campos ModXID de Access
        if (!isNaN(numericModId) && numericModId > 0 && modSlot <= 20) {
          modCols += `, Mod${modSlot}ID, Mod${modSlot}Cost`;
          modVals += `, ${numericModId}, ${modCost}`;
          modSlot++;
        }
        if (modName) {
          modNames.push(modName);
        }
      });

      let note = (item.notes || notes || '').trim();
      if (modNames.length > 0) {
        const modText = modNames.join(', ');
        note = note ? `${note} (${modText})` : modText;
      }
      // Aldelo POS ShortNote tiene un límite estricto de 40 caracteres en Access
      const safeNote = note.replace(/'/g, "''").slice(0, 40);
      const itemGuid = generateGUID();

      const sqlItem = `
        INSERT INTO OrderTransactions (
          OrderID, MenuItemID, MenuItemUnitPrice, Quantity, 
          ExtendedPrice, TransactionStatus, NotificationStatus, 
          DiscountTaxable, GSTTaxable, ShortNote, RowGUID${modCols}
        ) VALUES (
          ${orderId}, ${menuItemId}, ${basePrice}, ${qty}, 
          ${extendedPrice}, 1, 2, 
          1, -1, '${safeNote}', '${itemGuid}'${modVals}
        )
      `;
      await connection.execute(sqlItem);
    }

    // Si la orden ya está pagada (Kiosk o cobro inmediato), registrar en OrderPayments
    if (isPaid) {
      try {
        const payMethodCode = (paymentMethod === 'CASH') ? '1' : '3';
        const paymentGuid = generateGUID();
        const sqlPayment = `
          INSERT INTO OrderPayments (
            PaymentDateTime, CashierID, OrderID, PaymentMethod, 
            AmountTendered, AmountPaid, EmployeeComp, RowGUID
          ) VALUES (
            ${accessDate}, ${employeeId || 1}, ${orderId}, '${payMethodCode}', 
            ${totalAmount}, ${totalAmount}, 0, '${paymentGuid}'
          )
        `;
        await connection.execute(sqlPayment);
      } catch (payErr) {
        console.error('[OrderPayments Error]:', payErr.message);
      }
    }

    // Si la orden no está pagada (ej. Autoservicio Kiosk con Efectivo o Datáfono),
    // NO va a cocina: queda en estado WAITING_PAYMENT hasta completar pago en Front Desk.
    // Solo si ya está pagada (Wompi QR o cobro en caja) entra directamente a PREPARING.
    const initialKdsStatus = isPaid ? kdsStore.KDS_STATUSES.PREPARING : kdsStore.KDS_STATUSES.WAITING_PAYMENT;
    kdsStore.setKdsState(orderId, { kdsStatus: initialKdsStatus });

    const orderNum = orderId % 100 === 0 ? 100 : orderId % 100;
    const receiptInfo = receiptService.generateReceiptCode(orderId, new Date(), {
      orderNumber: orderNum,
      total: totalAmount,
      paymentMethod
    });

    return {
      orderId,
      orderNumber: orderNum, // Número de turno amigable (1-99)
      total: totalAmount,
      itemsCount: items.length,
      status: initialOrderStatus, // '2' = SettledOrder (Pagada), '1' = OpenOrder
      isPaid: !!isPaid,
      kdsStatus: initialKdsStatus,
      createdAt: new Date().toISOString(),
      paymentMethod,
      receiptCode: receiptInfo.urlCode,
      receiptUrl: receiptInfo.path,
      transactionRef: receiptInfo.transactionRef,
      receiptFullUrl: receiptInfo.fullUrl
    };
  },

  // 5. Actualizar estado de la orden según especificación Aldelo POS:
  // 1 = OpenOrder (Orden abierta / pendiente)
  // 2 = SettledOrder (Orden pagada y cerrada / completada)
  // 3 = VoidedOrder (Orden anulada)
  async updateOrderStatus(orderId, status, tableReady = null, paymentMethod = 'CASH', cashierId = 1) {
    let sql = `UPDATE OrderHeaders SET OrderStatus = '${status}'`;
    if (tableReady !== null) {
      sql += `, TableReady = ${tableReady ? 'True' : 'False'}`;
    }
    sql += ` WHERE OrderID = ${orderId}`;
    await connection.execute(sql);

    // Si la orden pasa a pagada ('2'), enviarla inmediatamente a cocina (PREPARING)
    if (status === '2') {
      kdsStore.setKdsState(orderId, { kdsStatus: kdsStore.KDS_STATUSES.PREPARING });

      // Registrar pago en OrderPayments si no existía
      try {
        const orderRes = await connection.query(`SELECT AmountDue, EmployeeID FROM OrderHeaders WHERE OrderID = ${orderId}`);
        if (orderRes && orderRes.length > 0) {
          const totalAmount = orderRes[0].AmountDue || 0;
          const payMethodCode = (paymentMethod === 'CASH') ? '1' : '3';
          const paymentGuid = generateGUID();
          const accessDate = getAccessDate(new Date());
          const sqlPayment = `
            INSERT INTO OrderPayments (
              PaymentDateTime, CashierID, OrderID, PaymentMethod, 
              AmountTendered, AmountPaid, EmployeeComp, RowGUID
            ) VALUES (
              ${accessDate}, ${cashierId || 1}, ${orderId}, '${payMethodCode}', 
              ${totalAmount}, ${totalAmount}, 0, '${paymentGuid}'
            )
          `;
          await connection.execute(sqlPayment);
        }
      } catch (payErr) {
        console.error('[updateOrderStatus OrderPayments error]:', payErr.message);
      }
    }

    return { orderId, status, tableReady, kdsStatus: status === '2' ? 'PREPARING' : 'WAITING_PAYMENT' };
  },

  async setTableReady(orderId, isReady = true) {
    const val = isReady ? 'True' : 'False';
    const sql = `UPDATE OrderHeaders SET TableReady = ${val} WHERE OrderID = ${orderId}`;
    await connection.execute(sql);
    return { orderId, tableReady: isReady };
  },

  // 6. Actualizar estado operativo exclusivo de COCINA (KDS):
  // PREPARING (En preparación, TableReady = False, PackagerAlreadyPrinted = False)
  // READY (Listo para retiro, TableReady = True, PackagerAlreadyPrinted = False)
  // SERVED (Entregada / Despachada, TableReady = False, PackagerAlreadyPrinted = True)
  async updateKdsStatus(orderId, kdsStatus, itemChecks = null) {
    const kdsState = kdsStore.setKdsState(orderId, { kdsStatus, itemChecks });

    try {
      if (kdsStatus === kdsStore.KDS_STATUSES.READY) {
        await connection.execute(`UPDATE OrderHeaders SET TableReady = True, PackagerAlreadyPrinted = False WHERE OrderID = ${orderId}`);
      } else if (kdsStatus === kdsStore.KDS_STATUSES.SERVED) {
        await connection.execute(`UPDATE OrderHeaders SET TableReady = False, PackagerAlreadyPrinted = True WHERE OrderID = ${orderId}`);
      } else {
        // PREPARING
        await connection.execute(`UPDATE OrderHeaders SET TableReady = False, PackagerAlreadyPrinted = False WHERE OrderID = ${orderId}`);
      }
    } catch (dbErr) {
      console.error('[Aldelo DB] Error updating OrderHeaders for KDS:', dbErr.message);
    }

    return { orderId, ...kdsState };
  },

  async getTables() {
    const sql = `
      SELECT t.DineInTableID as id, t.DineInTableText as name, t.TableGroupID as groupId, g.TableGroupText as groupName, t.DineInTableInActive as inActive
      FROM DineInTables t
      LEFT JOIN DineInTableGroups g ON t.TableGroupID = g.TableGroupID
      WHERE (t.DineInTableInActive = False OR t.DineInTableInActive IS NULL)
    `;
    const tables = await connection.query(sql);
    return (tables || []).sort((a, b) => {
      const numA = parseInt(a.name || a.id, 10);
      const numB = parseInt(b.name || b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
  },

  getKdsStore() {
    return kdsStore;
  },

  getProductsSource() {
    return productsConnectionString;
  },

  getDbSource() {
    return connectionString;
  },

  async getOrderReceiptData(orderId) {
    const numId = parseInt(orderId, 10);
    if (!numId) return null;

    const headers = await connection.query(`SELECT TOP 1 * FROM OrderHeaders WHERE OrderID = ${numId}`);
    if (!headers || headers.length === 0) return null;
    const header = headers[0];

    const items = await connection.query(`
      SELECT 
        t.OrderTransactionID, t.OrderID, t.MenuItemID, t.MenuItemUnitPrice, 
        t.Quantity, t.ExtendedPrice, t.ShortNote,
        t.Mod1ID, t.Mod1Cost, t.Mod2ID, t.Mod2Cost, t.Mod3ID, t.Mod3Cost,
        t.Mod4ID, t.Mod4Cost, t.Mod5ID, t.Mod5Cost,
        m.MenuItemText
      FROM OrderTransactions t
      LEFT JOIN MenuItems m ON t.MenuItemID = m.MenuItemID
      WHERE t.OrderID = ${numId}
    `);

    let modMap = {};
    try {
      const allMods = await productsConnection.query('SELECT MenuModifierID as id, MenuModifierText as name FROM MenuModifiers');
      (allMods || []).forEach(m => { modMap[m.id] = m.name; });
    } catch (_) {}

    const formattedItems = (items || []).map(item => {
      const itemMods = [];
      for (let i = 1; i <= 5; i++) {
        const mId = item[`Mod${i}ID`];
        if (mId && modMap[mId]) {
          itemMods.push({
            id: mId,
            name: modMap[mId],
            price: item[`Mod${i}Cost`] || 0
          });
        }
      }
      return {
        id: item.OrderTransactionID,
        menuItemId: item.MenuItemID,
        name: item.MenuItemText || 'Producto',
        unitPrice: item.MenuItemUnitPrice,
        quantity: item.Quantity || 1,
        extendedPrice: item.ExtendedPrice || item.MenuItemUnitPrice,
        notes: item.ShortNote || '',
        modifiers: itemMods
      };
    });

    let paymentMethod = 'WOMPI_QR';
    let approvalRef = `M-${Math.floor(1000000 + Math.random() * 9000000)}`;
    try {
      const payments = await connection.query(`SELECT TOP 1 * FROM OrderPayments WHERE OrderID = ${numId} ORDER BY OrderPaymentID DESC`);
      if (payments && payments.length > 0) {
        paymentMethod = payments[0].PaymentMethod || '3';
        if (payments[0].EDCTransID) approvalRef = payments[0].EDCTransID;
      }
    } catch (_) {}

    return {
      orderId: numId,
      orderNumber: numId % 100 === 0 ? 100 : numId % 100,
      orderDate: header.OrderDateTime,
      orderType: header.OrderType,
      tableId: header.DineInTableID,
      totalAmount: header.AmountDue || header.SubTotal || 0,
      items: formattedItems,
      paymentMethod,
      approvalRef
    };
  }
};

module.exports = aldeloService;
