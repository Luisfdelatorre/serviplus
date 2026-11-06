const ADODB = require('node-adodb');
const config = require('./config').getConfig();
const { sqlInt, sqlNum, sqlStr, sqlBool, sqlEnum } = require('./lib/sql');
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
        m.DisplayIndex as itemOrder,
        m.MenuItemNotification as menuItemNotification
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
        hasModifiers: itemMods.length > 0,
        menuItemNotification: String(item.menuItemNotification || '1'),
        isKitchenItem: String(item.menuItemNotification) === '2'
      });
    });

    return Object.values(categoriesMap).sort((a, b) => a.order - b.order);
  },

  // 1b. Obtener todos los productos (incluyendo agotados/inactivos) para el panel de administración
  async getAllProductsAdmin() {
    const sql = `
      SELECT 
        m.MenuItemID as id, 
        IIF(g.MenuGroupID IS NOT NULL, g.MenuGroupID, m.MenuCategoryID) as categoryId, 
        IIF(g.MenuGroupText IS NOT NULL, g.MenuGroupText, 'General') as categoryName, 
        m.MenuItemText as name, 
        m.DefaultUnitPrice as price, 
        m.MenuItemDescription as description,
        IIF(m.MenuItemInActive IS NULL OR m.MenuItemInActive = 0 OR m.MenuItemInActive = False, True, False) as isActive
      FROM MenuItems m
      LEFT JOIN MenuGroups g ON m.MenuGroupID = g.MenuGroupID
      WHERE m.DefaultUnitPrice > 0
      ORDER BY IIF(g.DisplayIndex IS NOT NULL, g.DisplayIndex, 999), g.MenuGroupText, m.MenuItemText
    `;
    const items = await productsConnection.query(sql);
    return (items || []).map(item => ({
      id: item.id,
      name: item.name,
      price: Number(item.price.toFixed(2)),
      categoryId: item.categoryId,
      categoryName: item.categoryName || 'General',
      description: item.description || '',
      isActive: Boolean(item.isActive)
    }));
  },

  // 1c. Cambiar disponibilidad de un producto (Agotado / Activo) en kebab.mdb
  async setProductAvailability(menuItemId, isActive) {
    const id = parseInt(menuItemId, 10);
    if (!id || isNaN(id)) throw new Error('ID de producto inválido');
    const inactiveVal = isActive ? 'False' : 'True';
    const sql = `UPDATE MenuItems SET MenuItemInActive = ${inactiveVal} WHERE MenuItemID = ${id}`;
    await productsConnection.execute(sql);
    return { success: true, id, isActive: Boolean(isActive) };
  },

  // 2. Obtener lista de empleados (NUNCA exponer AccessCode/PIN al cliente)
  async getEmployees() {
    const sql = `
      SELECT EmployeeID as id, FirstName as firstName, LastName as lastName
      FROM EmployeeFiles
      ORDER BY FirstName, LastName
    `;
    return await connection.query(sql);
  },

  // 2b. Verificar acceso de administrador / gerente (SecurityLevel <= 2)
  async verifyAdminAccess(accessCode) {
    if (!accessCode) return { success: false, error: 'Código de acceso requerido' };
    const cleanPin = sqlStr(String(accessCode).trim(), 20);
    const sql = `
      SELECT EmployeeID as id, FirstName as firstName, LastName as lastName, SecurityLevel as securityLevel
      FROM EmployeeFiles
      WHERE (AccessCode = ${cleanPin})
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

  // 2c. Verificar login de empleado / cajero / admin general
  async verifyEmployeeLogin(accessCode) {
    if (!accessCode) return { success: false, error: 'Código de acceso requerido' };
    const cleanPin = String(accessCode).trim();
    try {
      const sql = `
        SELECT EmployeeID as id, FirstName as firstName, LastName as lastName, SecurityLevel as securityLevel
        FROM EmployeeFiles
        WHERE (AccessCode = ${sqlStr(cleanPin, 20)})
        AND (EmployeeInActive = False OR EmployeeInActive IS NULL)
      `;
      const records = await connection.query(sql);
      if (records && records.length > 0) {
        const emp = records[0];
        const secLevel = parseInt(emp.securityLevel, 10);
        const isAdmin = !isNaN(secLevel) && secLevel <= 2;
        return {
          success: true,
          employee: {
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName || ''}`.trim(),
            firstName: emp.firstName,
            lastName: emp.lastName || '',
            securityLevel: secLevel || 5,
            role: isAdmin ? 'admin' : 'cashier',
            isAdmin
          }
        };
      }
    } catch (err) {
      console.warn('[aldeloService.verifyEmployeeLogin] Error consultando empleado en Access:', err.message);
    }

    // Código maestro de respaldo / demo (ej: 1234 o 9999).
    // Solo habilitado explícitamente con ALLOW_DEMO_PIN=true (nunca en producción).
    if (process.env.ALLOW_DEMO_PIN === 'true' && (cleanPin === '1234' || cleanPin === '9999')) {
      return {
        success: true,
        employee: {
          id: 1,
          name: 'Administrador Master',
          firstName: 'Admin',
          lastName: 'Master',
          securityLevel: 1,
          role: 'admin',
          isAdmin: true
        }
      };
    }

    return { success: false, error: 'Código de empleado incorrecto o inactivo' };
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
    const orderIds = orders
      .slice(0, 60)
      .map((o) => sqlInt(o.OrderID, { min: 1, fallback: 0 }))
      .filter((id) => id > 0)
      .join(',');
    if (!orderIds) return [];
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
        m.MenuItemDescription,
        m.MenuItemNotification
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

      // En Aldelo POS: MenuItemNotification === '2' es "Cocina".
      // Si el ítem no va a cocina (ej. MenuItemNotification === '1', bebidas o refrescos), se marca isKitchenItem = false.
      const notifVal = String(item.MenuItemNotification || '1');
      const isKitchenItem = notifVal === '2';

      itemsByOrder[item.OrderID].push({
        id: item.OrderTransactionID,
        menuItemId: item.MenuItemID,
        name: item.MenuItemText,
        unitPrice: item.MenuItemUnitPrice,
        quantity: item.Quantity,
        extendedPrice: item.ExtendedPrice,
        notes: item.ShortNote || '',
        modifiers: itemMods,
        prepTime: itemPrepTime,
        menuItemNotification: notifVal,
        isKitchenItem: isKitchenItem
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

  // Obtener o inicializar ID de cajero activo en RegisterCashiers (Aldelo POS)
  async getActiveCashierId(employeeId = 1, stationId = 3) {
    try {
      const rc = await connection.query('SELECT TOP 1 CashierID FROM RegisterCashiers WHERE SignOutDateTime IS NULL ORDER BY CashierID DESC');
      if (rc && rc.length > 0 && rc[0].CashierID) {
        return rc[0].CashierID;
      }
      const guid = generateGUID();
      const resRc = await connection.execute(
        `INSERT INTO RegisterCashiers (EmployeeID, StationID, CashTrayID, SignInDateTime, RegisterStartAmount, RowGUID) VALUES (${sqlInt(employeeId, { min: 1, fallback: 1 })}, ${sqlInt(stationId, { min: 1, fallback: 3 })}, 1, Now(), 0, '${guid}')`,
        'SELECT @@Identity AS id'
      );
      if (resRc && resRc.length > 0 && resRc[0].id) {
        return resRc[0].id;
      }
    } catch (cErr) {
      console.warn('[getActiveCashierId Error]:', cErr.message);
    }
    return 1;
  },

  // 3b. Entrada de cajero en Aldelo POS (RegisterCashiers - Sign In)
  async signInCashier({ employeeId = 1, stationId = 3, startAmount = 0 }) {
    try {
      const guid = generateGUID();
      const numStart = sqlNum(startAmount, { min: 0 });
      const sql = `INSERT INTO RegisterCashiers (EmployeeID, StationID, CashTrayID, SignInDateTime, RegisterStartAmount, RowGUID) VALUES (${sqlInt(employeeId, { min: 1, fallback: 1 })}, ${sqlInt(stationId, { min: 1, fallback: 3 })}, 1, Now(), ${numStart}, '${guid}')`;
      await connection.execute(sql);
      return { success: true };
    } catch (e) {
      console.warn('[aldeloService.signInCashier]:', e.message);
      return { success: false, error: e.message };
    }
  },

  // 3c. Salida de cajero en Aldelo POS (RegisterCashiers - Sign Out)
  async signOutCashier({ cashierId = null, employeeId = null, endAmount = 0, discrepancy = 0, notes = '' }) {
    try {
      const numEnd = sqlNum(endAmount);
      const numDisc = sqlNum(discrepancy);
      const cleanNotes = String(notes || '').trim();
      const notesVal = cleanNotes ? sqlStr(cleanNotes, 255) : 'NULL';
      let whereClause = 'SignOutDateTime IS NULL';
      if (cashierId) {
        whereClause += ` AND CashierID = ${sqlInt(cashierId, { min: 1 })}`;
      } else if (employeeId) {
        whereClause += ` AND EmployeeID = ${sqlInt(employeeId, { min: 1 })}`;
      }
      const sql = `UPDATE RegisterCashiers SET SignOutDateTime = Now(), RegisterEndAmount = ${numEnd}, DiscrepancyAmount = ${numDisc}, DiscrepancyNotes = ${notesVal} WHERE ${whereClause}`;
      await connection.execute(sql);
      return { success: true };
    } catch (e) {
      console.warn('[aldeloService.signOutCashier]:', e.message);
      return { success: false, error: e.message };
    }
  },

  // 4. Crear una nueva orden (desde Kiosk o Front Desk)
  // Nota: Las órdenes de Kiosk se crean con isPaid = true porque el pago se recibe previamente.
  async createOrder({ employeeId = 1, orderType = 1, items = [], tableId = null, guestNumber = 1, notes = '', paymentMethod = 'CASH', isPaid = true, transactionRef = '', wompiTransactionId = '' }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('La orden debe contener al menos un producto.');
    }

    const safeEmployeeId = sqlInt(employeeId, { min: 1, fallback: 1 });
    const safeOrderType = sqlInt(orderType, { min: 1, max: 10, fallback: 1 });
    const safeGuestNumber = sqlInt(guestNumber, { min: 1, max: 999, fallback: 1 });

    // Cargar catálogo de precios oficial desde la BD para evitar manipulación desde el cliente
    const dbItemPrices = {};
    const dbModPrices = {};
    try {
      const itemIds = items
        .map((it) => sqlInt(it.id || it.menuItemId, { min: 1, fallback: 0 }))
        .filter((id) => id > 0);
      if (itemIds.length > 0) {
        const dbItems = await productsConnection.query(
          `SELECT MenuItemID as id, DefaultUnitPrice as price FROM MenuItems WHERE MenuItemID IN (${[...new Set(itemIds)].join(',')})`
        );
        (dbItems || []).forEach((r) => {
          dbItemPrices[r.id] = Number(r.price) || 0;
        });
      }
      const dbMods = await productsConnection.query(
        'SELECT MenuModifierID as id, AdditionalCost as price FROM MenuModifiers'
      );
      (dbMods || []).forEach((m) => {
        dbModPrices[m.id] = Number(m.price) || 0;
      });
    } catch (priceErr) {
      console.warn('[createOrder] Warning loading official DB prices:', priceErr.message);
    }

    // Calcular monto total sumando precios de ítems y sus modificadores (autoritativo del servidor si existe en BD)
    let calculatedTotal = 0;
    const normalizedItems = [];
    for (const item of items) {
      const menuItemId = sqlInt(item.id || item.menuItemId, { min: 1, fallback: 0 });
      if (menuItemId <= 0) continue;

      const qty = sqlInt(item.quantity, { min: 1, max: 999, fallback: 1 });
      const clientBase = sqlNum(item.basePrice !== undefined ? item.basePrice : item.price, { min: 0, fallback: 0 });
      const basePrice = dbItemPrices[menuItemId] !== undefined ? dbItemPrices[menuItemId] : clientBase;

      const rawMods = Array.isArray(item.modifiers) ? item.modifiers : (Array.isArray(item.modifi) ? item.modifi : []);
      const cleanMods = rawMods.map((m) => {
        const modId = sqlInt(m.id || m.MenuModifierID, { min: 1, fallback: 0 });
        const clientModPrice = sqlNum(m.price !== undefined ? m.price : m.P, { min: 0, fallback: 0 });
        const modPrice = (modId > 0 && dbModPrices[modId] !== undefined) ? dbModPrices[modId] : clientModPrice;
        return {
          id: modId,
          price: modPrice,
          name: String(m.name || m.N || m.MenuModifierText || '').trim()
        };
      });

      const modCostSum = cleanMods.reduce((acc, m) => acc + m.price, 0);
      calculatedTotal += (basePrice + modCostSum) * qty;
      normalizedItems.push({
        menuItemId,
        qty,
        basePrice,
        cleanMods,
        modCostSum,
        notes: item.notes || ''
      });
    }

    if (normalizedItems.length === 0) {
      throw new Error('La orden no contiene productos válidos.');
    }

    const totalAmount = sqlNum(calculatedTotal, { min: 0, decimals: 2 });
    const accessDate = getAccessDate(new Date());
    const rowGuid = generateGUID();
    const initialOrderStatus = isPaid ? '2' : '1'; // 2 = SettledOrder (Pagada), 1 = OpenOrder (Pendiente de pago)
    let resolvedTableId = null;
    // En Aldelo POS, las órdenes para llevar (OrderType = 2) no tienen mesa (DineInTableID = NULL)
    if (safeOrderType === 1 && tableId) {
      const tableNum = sqlInt(tableId, { min: 1, max: 9999, fallback: 0 });
      const safeTableText = sqlStr(String(tableId).trim(), 20);
      if (tableNum > 0) {
        try {
          const match = await connection.query(`SELECT TOP 1 DineInTableID FROM DineInTables WHERE DineInTableID = ${tableNum} OR DineInTableText = ${safeTableText}`);
          if (match && match.length > 0) {
            resolvedTableId = sqlInt(match[0].DineInTableID, { min: 1, fallback: tableNum });
          } else {
            const g = generateGUID();
            await connection.execute(`INSERT INTO DineInTables (DineInTableText, TableGroupID, DisplayIndex, RowGUID) VALUES (${safeTableText}, 1, ${tableNum}, '${g}')`);
            const created = await connection.query(`SELECT TOP 1 DineInTableID FROM DineInTables WHERE DineInTableText = ${safeTableText}`);
            if (created && created.length > 0) {
              resolvedTableId = sqlInt(created[0].DineInTableID, { min: 1, fallback: tableNum });
            }
          }
        } catch (tErr) {
          console.error('[Table Resolution]', tErr.message);
          resolvedTableId = tableNum;
        }
      }
    }

    const tableValue = (safeOrderType === 1 && resolvedTableId) ? sqlInt(resolvedTableId, { min: 1 }) : 'NULL';

    // Resolver StationID válido desde StationSettings de Aldelo (Evita error de clave foránea)
    let resolvedStationId = sqlInt((config.db && config.db.stationId) || 3, { min: 1, fallback: 3 });
    try {
      const stRows = await connection.query('SELECT TOP 1 StationID FROM StationSettings ORDER BY StationID');
      if (stRows && stRows.length > 0 && stRows[0].StationID) {
        resolvedStationId = sqlInt(stRows[0].StationID, { min: 1, fallback: resolvedStationId });
      }
    } catch (stErr) {
      console.warn('[Station Resolution Error]:', stErr.message);
    }

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
        ${accessDate}, ${safeEmployeeId}, ${resolvedStationId}, ${safeOrderType}, ${tableValue}, 
        0, 0, 0, 0, '${initialOrderStatus}', 
        ${totalAmount}, 1, 1, 1, 
        1, 0, ${totalAmount}, 0, 
        0, 0, 0, 0, 0, 
        ${safeGuestNumber}, 0, 0, 1, 
        1, 1, 0, 0, 
        1, 0, 0, 0, '${rowGuid}'
      )
    `;

    // Insertar encabezado y recuperar el OrderID autoincremental
    const result = await connection.execute(sqlHeader, 'SELECT @@Identity AS id');
    const orderId = result && result.length > 0 ? sqlInt(result[0].id, { min: 1, fallback: 0 }) : 0;

    if (!orderId) {
      throw new Error('No se pudo obtener el identificador de la nueva orden.');
    }

    // Insertar cada ítem en OrderTransactions soportando modificadores de Aldelo (Mod1ID...Mod20ID)
    for (const normItem of normalizedItems) {
      const { menuItemId, qty, basePrice, cleanMods, modCostSum } = normItem;
      const unitPriceWithMods = basePrice + modCostSum;
      const extendedPrice = sqlNum(unitPriceWithMods * qty, { min: 0, decimals: 2 });

      let modCols = '';
      let modVals = '';
      const modNames = [];
      let modSlot = 1;

      cleanMods.forEach((mod) => {
        if (mod.id > 0 && modSlot <= 20) {
          modCols += `, Mod${modSlot}ID, Mod${modSlot}Cost`;
          modVals += `, ${mod.id}, ${sqlNum(mod.price, { min: 0, decimals: 2 })}`;
          modSlot++;
        }
        if (mod.name) {
          modNames.push(mod.name);
        }
      });

      let note = String(normItem.notes || notes || '').trim();
      if (modNames.length > 0) {
        const modText = modNames.join(', ');
        note = note ? `${note} (${modText})` : modText;
      }
      // Aldelo POS ShortNote tiene un límite estricto de 40 caracteres en Access
      const safeNoteLiteral = sqlStr(note, 40);
      const itemGuid = generateGUID();

      const sqlItem = `
        INSERT INTO OrderTransactions (
          OrderID, MenuItemID, MenuItemUnitPrice, Quantity, 
          ExtendedPrice, TransactionStatus, NotificationStatus, 
          DiscountTaxable, GSTTaxable, ShortNote, RowGUID${modCols}
        ) VALUES (
          ${orderId}, ${menuItemId}, ${basePrice}, ${qty}, 
          ${extendedPrice}, 1, 2, 
          1, -1, ${safeNoteLiteral}, '${itemGuid}'${modVals}
        )
      `;
      await connection.execute(sqlItem);
    }

    // Si la orden ya está pagada (Kiosk o cobro inmediato), registrar en OrderPayments nativo
    if (isPaid) {
      try {
        const payMethodCode = (paymentMethod === 'CASH') ? '1' : '3';
        const paymentGuid = generateGUID();
        const safeRefLiteral = sqlStr(transactionRef || '', 50);
        const safeTxIdLiteral = sqlStr(wompiTransactionId || transactionRef || '', 50);
        const activeCashierId = await this.getActiveCashierId(safeEmployeeId, resolvedStationId);

        // En Access: GlobalID y LastRowHash son de tipo Short Text (perfectos para referencias bancarias y transacciones)
        const sqlPayment = `
          INSERT INTO OrderPayments (
            PaymentDateTime, CashierID, OrderID, PaymentMethod, 
            AmountTendered, AmountPaid, EmployeeComp, RowGUID, GlobalID, LastRowHash
          ) VALUES (
            ${accessDate}, ${sqlInt(activeCashierId, { min: 1, fallback: 1 })}, ${orderId}, '${payMethodCode}', 
            ${totalAmount}, ${totalAmount}, 0, '${paymentGuid}', ${safeRefLiteral}, ${safeTxIdLiteral}
          )
        `;
        await connection.execute(sqlPayment);

        // Actualizar registro en la tabla nativa KioskPayments de Access
        if (transactionRef) {
          await this.updateKioskPaymentStatus(transactionRef, 'APPROVED', { orderId, transactionId: wompiTransactionId });
        }

        // Asociar el número de orden al pago en paymentStore si existe
        try {
          const paymentStore = require('./paymentStore');
          if (transactionRef) {
            paymentStore.updateStatus(transactionRef, 'APPROVED', { orderId });
          }
        } catch (_) {}
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
    const safeOrderId = sqlInt(orderId, { min: 1 });
    const safeStatus = sqlEnum(status, ['1', '2', '3']);
    let sql = `UPDATE OrderHeaders SET OrderStatus = '${safeStatus}'`;
    if (tableReady !== null && tableReady !== undefined) {
      sql += `, TableReady = ${sqlBool(tableReady)}`;
    }
    sql += ` WHERE OrderID = ${safeOrderId}`;
    await connection.execute(sql);

    // Si la orden pasa a pagada ('2'), enviarla inmediatamente a cocina (PREPARING)
    if (safeStatus === '2') {
      kdsStore.setKdsState(safeOrderId, { kdsStatus: kdsStore.KDS_STATUSES.PREPARING });

      // Registrar pago en OrderPayments si no existía
      try {
        const orderRes = await connection.query(`SELECT AmountDue, EmployeeID, StationID FROM OrderHeaders WHERE OrderID = ${safeOrderId}`);
        if (orderRes && orderRes.length > 0) {
          const totalAmount = sqlNum(orderRes[0].AmountDue, { min: 0, decimals: 2 });
          const payMethodCode = (paymentMethod === 'CASH') ? '1' : '3';
          const paymentGuid = generateGUID();
          const accessDate = getAccessDate(new Date());
          const activeCashierId = await this.getActiveCashierId(orderRes[0].EmployeeID || 1, orderRes[0].StationID || 3);
          const sqlPayment = `
            INSERT INTO OrderPayments (
              PaymentDateTime, CashierID, OrderID, PaymentMethod, 
              AmountTendered, AmountPaid, EmployeeComp, RowGUID
            ) VALUES (
              ${accessDate}, ${sqlInt(activeCashierId, { min: 1, fallback: 1 })}, ${safeOrderId}, '${payMethodCode}', 
              ${totalAmount}, ${totalAmount}, 0, '${paymentGuid}'
            )
          `;
          await connection.execute(sqlPayment);
        }
      } catch (payErr) {
        console.error('[updateOrderStatus OrderPayments error]:', payErr.message);
      }
    }

    return { orderId: safeOrderId, status: safeStatus, tableReady, kdsStatus: safeStatus === '2' ? 'PREPARING' : 'WAITING_PAYMENT' };
  },

  async setTableReady(orderId, isReady = true) {
    const safeOrderId = sqlInt(orderId, { min: 1 });
    const val = sqlBool(isReady);
    const sql = `UPDATE OrderHeaders SET TableReady = ${val} WHERE OrderID = ${safeOrderId}`;
    await connection.execute(sql);
    return { orderId: safeOrderId, tableReady: Boolean(isReady) };
  },

  // 6. Actualizar estado operativo exclusivo de COCINA (KDS):
  // PREPARING (En preparación, TableReady = False, PackagerAlreadyPrinted = False)
  // READY (Listo para retiro, TableReady = True, PackagerAlreadyPrinted = False)
  // SERVED (Entregada / Despachada, TableReady = False, PackagerAlreadyPrinted = True)
  async updateKdsStatus(orderId, kdsStatus, itemChecks = null) {
    const safeOrderId = sqlInt(orderId, { min: 1 });
    const kdsState = kdsStore.setKdsState(safeOrderId, { kdsStatus, itemChecks });

    try {
      if (kdsStatus === kdsStore.KDS_STATUSES.READY) {
        await connection.execute(`UPDATE OrderHeaders SET TableReady = True, PackagerAlreadyPrinted = False WHERE OrderID = ${safeOrderId}`);
      } else if (kdsStatus === kdsStore.KDS_STATUSES.SERVED) {
        await connection.execute(`UPDATE OrderHeaders SET TableReady = False, PackagerAlreadyPrinted = True WHERE OrderID = ${safeOrderId}`);
      } else {
        // PREPARING
        await connection.execute(`UPDATE OrderHeaders SET TableReady = False, PackagerAlreadyPrinted = False WHERE OrderID = ${safeOrderId}`);
      }
    } catch (dbErr) {
      console.error('[Aldelo DB] Error updating OrderHeaders for KDS:', dbErr.message);
    }

    return { orderId: safeOrderId, ...kdsState };
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
  },

  /**
   * Registra una intención de pago en la tabla KioskPayments de Access (Fase 1: ANTES de pagar)
   */
  async saveKioskPaymentIntent({
    reference,
    transactionId = '',
    amount = 0,
    amountCOP = 0,
    cart = [],
    tableId = 0,
    orderType = 1,
    customerEmail = ''
  }) {
    if (!reference) return null;
    const safeRef = sqlStr(reference, 80);
    const safeTxId = sqlStr(transactionId || '', 80);
    const safeCart = sqlStr(JSON.stringify(cart || []), 4000);
    const safeEmail = sqlStr(customerEmail || '', 120);
    const safeTable = sqlInt(tableId, { min: 0, max: 9999, fallback: 0 });
    const safeOrderType = sqlInt(orderType, { min: 1, max: 10, fallback: 1 });
    const aldeloAmount = sqlNum(amount, { min: 0, decimals: 2 });
    const copAmount = sqlNum(amountCOP || Math.round(aldeloAmount * 1000), { min: 0, decimals: 0 });

    const sql = `
      INSERT INTO KioskPayments (
        [Reference], [TransactionID], [OrderID], [AmountCOP], [AmountAldelo], 
        [PaymentStatus], [PaymentMethod], [CartData], [TableID], [OrderType], 
        [CustomerEmail], [CreatedAt]
      ) VALUES (
        ${safeRef}, ${safeTxId}, 0, ${copAmount}, ${aldeloAmount}, 
        'PENDING', 'BANCOLOMBIA_QR', ${safeCart}, ${safeTable}, ${safeOrderType}, 
        ${safeEmail}, Now()
      )
    `;
    try {
      await connection.execute(sql);
      return { reference, status: 'PENDING' };
    } catch (e) {
      console.error('[KioskPayments] Error saving intent to Access:', e.message);
      return null;
    }
  },

  /**
   * Actualiza el estado de un pago en KioskPayments en Access (Fase 2: DESPUÉS de pagar)
   */
  async updateKioskPaymentStatus(identifier, status = 'APPROVED', { orderId = 0, transactionId = '' } = {}) {
    if (!identifier) return null;
    const safeId = sqlStr(identifier, 80);
    const safeStatus = sqlStr(status, 30);
    const numOrder = sqlInt(orderId, { min: 0, fallback: 0 });
    const safeTx = transactionId ? sqlStr(transactionId, 80) : '';

    let sql = `UPDATE KioskPayments SET [PaymentStatus] = ${safeStatus}, [ApprovedAt] = Now()`;
    if (numOrder > 0) {
      sql += `, [OrderID] = ${numOrder}`;
    }
    if (safeTx) {
      sql += `, [TransactionID] = ${safeTx}`;
    }
    sql += ` WHERE [Reference] = ${safeId} OR [TransactionID] = ${safeId}`;

    try {
      await connection.execute(sql);
      return true;
    } catch (e) {
      console.error('[KioskPayments] Error updating status in Access:', e.message);
      return false;
    }
  },

  /**
   * Retorna las transacciones registradas en KioskPayments desde Access
   */
  async getKioskPayments(limit = 50) {
    try {
      const safeLimit = sqlInt(limit, { min: 1, max: 500, fallback: 50 });
      const sql = `SELECT TOP ${safeLimit} * FROM KioskPayments ORDER BY [PaymentID] DESC`;
      return await connection.query(sql);
    } catch (e) {
      console.error('[KioskPayments] Error querying Access:', e.message);
      return [];
    }
  }
};

module.exports = aldeloService;
