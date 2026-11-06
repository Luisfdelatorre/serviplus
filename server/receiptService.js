const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const appConfig = require('./config');

// Crockford Base32 (32 caracteres legibles sin ambigüedad)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SECRET_KEY = process.env.RECEIPT_SECRET || 'serviplus_digital_receipts_secret_key_v1';

function getReceiptBaseUrl() {
  try {
    const cfg = appConfig.getConfig();
    return cfg.cloud?.baseUrl || cfg.restaurant?.publicUrl || 'https://serviplus.upaysolutions.app';
  } catch (_) {
    return 'https://serviplus.upaysolutions.app';
  }
}

// Máscaras de ofuscación de bits (50 bits en total para 10 caracteres)
const MASK_A = 0x5a3f29; // 24 bits
const MASK_B = 0x8e71;   // 16 bits
const MASK_C = 0x2b3;    // 10 bits

// Cache en disco para persistir metadatos de recibos
const CACHE_FILE = path.join(__dirname, '../kds_receipts.json');
let receiptsCache = {};

try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    receiptsCache = JSON.parse(raw);
  }
} catch (e) {
  receiptsCache = {};
}

function persistCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(receiptsCache, null, 2), 'utf8');
  } catch (e) {
    console.error('[ReceiptService] Error saving cache:', e.message);
  }
}

/**
 * 1. Codifica un OrderID de manera pseudoaleatoria en 10 caracteres Base32
 */
function encodeTx(orderId, date = new Date()) {
  const numId = parseInt(orderId, 10) || 1;
  const epochMin = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 60000);
  const curMin = Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 60000);
  const timeOffset = Math.max(0, curMin - epochMin) & 0xFFFF; // 16 bits
  const salt = crypto.randomInt(0, 1024); // 10 bits

  const scrambledOrder = (numId ^ (salt * 1337 + MASK_A)) & 0xFFFFFF;
  const scrambledTime = (timeOffset ^ ((numId & 0xFFFF) + MASK_B)) & 0xFFFF;
  const scrambledSalt = (salt ^ MASK_C) & 0x3FF;

  const combined = (BigInt(scrambledOrder) << 26n) | (BigInt(scrambledTime) << 10n) | BigInt(scrambledSalt);

  let txId = '';
  let temp = combined;
  for (let i = 0; i < 10; i++) {
    const idx = Number(temp & 0x1Fn);
    txId = ALPHABET[idx] + txId;
    temp = temp >> 5n;
  }
  return txId;
}

/**
 * 2. Decodifica el ID de transacción de 10 caracteres de vuelta a OrderID
 */
function decodeTx(txId) {
  if (!txId || txId.length !== 10) return null;
  let combined = 0n;
  for (let i = 0; i < txId.length; i++) {
    const idx = ALPHABET.indexOf(txId[i]);
    if (idx === -1) return null;
    combined = (combined << 5n) | BigInt(idx);
  }
  const scrambledSalt = Number(combined & 0x3FFn);
  const scrambledOrder = Number((combined >> 26n) & 0xFFFFFFn);

  const salt = scrambledSalt ^ MASK_C;
  const orderId = (scrambledOrder ^ (salt * 1337 + MASK_A)) & 0xFFFFFF;
  return orderId;
}

/**
 * 3. Calcula el checksum HMAC de 3 caracteres (15 bits)
 */
function computeChecksum(txId) {
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(txId).digest();
  const num = ((hmac[0] << 8) | hmac[1]) & 0x7FFF; // 15 bits
  const c1 = ALPHABET[(num >> 10) & 0x1F];
  const c2 = ALPHABET[(num >> 5) & 0x1F];
  const c3 = ALPHABET[num & 0x1F];
  return c1 + c2 + c3;
}

/**
 * Genera el identificador único de URL de 13 caracteres: 10 de Tx + 3 de Checksum
 * Ej: "9ETZEMABAH7DE"
 */
function generateReceiptCode(orderId, date = new Date(), meta = {}) {
  const numId = parseInt(orderId, 10) || 1;
  const txId = encodeTx(numId, date);
  const checksum = computeChecksum(txId);
  const urlCode = `${txId}${checksum}`;
  const transactionRef = `SP-${txId}`;

  // Guardar en caché para resolución inmediata
  receiptsCache[urlCode] = {
    orderId: numId,
    txId,
    transactionRef,
    checksum,
    createdAt: (date instanceof Date ? date : new Date(date)).toISOString(),
    ...meta
  };
  persistCache();

  const baseUrl = getReceiptBaseUrl().replace(/\/+$/, '');
  return {
    txId,
    checksum,
    transactionRef,
    urlCode,
    path: `/p/${urlCode}`,
    fullUrl: `${baseUrl}/p/${urlCode}`
  };
}

/**
 * Verifica la firma del código de 13 caracteres y retorna el OrderID
 */
function verifyReceiptCode(code) {
  if (!code || typeof code !== 'string') return null;
  const clean = code.trim().toUpperCase();
  if (clean.length !== 13) return null;

  // 1. Revisar si está en caché
  if (receiptsCache[clean]) {
    return {
      orderId: receiptsCache[clean].orderId,
      txId: receiptsCache[clean].txId,
      transactionRef: receiptsCache[clean].transactionRef || `SP-${receiptsCache[clean].txId}`,
      meta: receiptsCache[clean]
    };
  }

  // 2. Verificar matemáticamente con Checksum HMAC
  const txId = clean.slice(0, 10);
  const providedChecksum = clean.slice(10, 13);
  const expectedChecksum = computeChecksum(txId);

  if (providedChecksum !== expectedChecksum) {
    return null; // Firma alterada o código inválido
  }

  // 3. Decodificar el OrderID de los 10 caracteres
  const orderId = decodeTx(txId);
  if (!orderId || orderId <= 0) return null;

  return {
    orderId,
    txId,
    transactionRef: `SP-${txId}`
  };
}

/**
 * Formateador de moneda en pesos colombianos (COP)
 */
function formatCOP(num) {
  let val = parseFloat(num) || 0;
  // En Aldelo Colombia 10 = $10.000 COP
  if (val < 500 && val > 0) {
    val = val * 1000;
  }
  return '$' + Math.round(val).toLocaleString('es-CO');
}

/**
 * Formatear fecha en español legible
 */
function formatReceiptDate(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const año = d.getFullYear();
  const hrs = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia} de ${mes}, ${año} • ${hrs}:${min} hrs`;
}

let cachedReceiptTemplate = null;

function getReceiptTemplatePath() {
  return path.join(__dirname, 'templates/receipt.html');
}

/**
 * Genera el marcado HTML para la lista de productos y modificadores
 */
function buildItemsHtml(items, totalNum) {
  if (!items || items.length === 0) {
    return `
      <div class="py-3 border-b border-dashed border-gray-300">
        <div class="flex justify-between items-start text-[14px] font-bold text-gray-900">
          <span>1x Consumo General</span>
          <span class="font-black text-gray-900">${formatCOP(totalNum)}</span>
        </div>
      </div>
    `;
  }

  return items.map((item) => {
    const qty = item.quantity || 1;
    const name = item.name || item.MenuItemText || 'Producto';
    const rawPrice = item.extendedPrice || item.price || item.unitPrice || 0;
    const price = formatCOP(rawPrice);

    // Modificadores
    const mods = item.modifiers || [];
    let modsHtml = '';
    if (mods && mods.length > 0) {
      const modItems = mods.map((m) => {
        const mName = m.name || m.N || m.MenuModifierText || '';
        const mCost = Number(m.price || m.P || 0);
        const costStr = mCost > 0 ? `+${formatCOP(mCost)}` : '';
        return `
          <div class="flex justify-between">
            <span>• ${mName}</span>
            <span class="font-medium text-gray-700">${costStr}</span>
          </div>
        `;
      }).join('');

      modsHtml = `<div class="pl-3 pt-1 text-[12px] text-gray-600 flex flex-col gap-0.5">${modItems}</div>`;
    }

    const note = item.notes ? `<div class="text-gray-500 text-[11px] italic mt-0.5">${item.notes}</div>` : '';

    return `
      <div class="py-3 border-b border-dashed border-gray-300">
        <div class="flex justify-between items-start text-[14px] font-bold text-gray-900">
          <span>${qty}x ${name}</span>
          <span class="font-black text-gray-900">${price}</span>
        </div>
        ${modsHtml}
        ${note}
      </div>
    `;
  }).join('');
}

/**
 * Resuelve los metadatos visuales del método de pago
 */
function resolvePaymentBadge(paymentMethod, approvalRef, totalNum) {
  let paymentBadge = {
    icon: 'QR',
    brand: 'QR Nequi',
    mode: 'Dinámico',
    account: 'Auto-Kiosco • Red Bancolombia / Nequi',
    refLabel: 'Ref. Aprobación',
    refVal: approvalRef || 'APROBADO',
    txLabel: 'ID Transacción Wompi/Nequi',
    txVal: `NQ-${Math.floor(10000000000 + Math.random() * 90000000000)}`
  };

  const pm = String(paymentMethod || '').toUpperCase();
  if (pm.includes('CASH') || pm === '1') {
    paymentBadge = {
      icon: '💵',
      brand: 'Efectivo',
      mode: 'Front Desk',
      account: 'Pago en Caja / Mostrador',
      refLabel: 'Caja POS',
      refVal: 'POS-01',
      txLabel: 'Recibido',
      txVal: formatCOP(totalNum)
    };
  } else if (pm.includes('CARD') || pm.includes('DATA') || pm === '3') {
    paymentBadge = {
      icon: '💳',
      brand: 'Tarjeta Débito/Crédito',
      mode: 'Datáfono',
      account: 'Terminal Bancolombia / Redeban',
      refLabel: 'No. Autorización',
      refVal: approvalRef || 'M-9482014',
      txLabel: 'Franquicia',
      txVal: 'VISA / MASTERCARD'
    };
  }

  return paymentBadge;
}

/**
 * Genera el documento HTML del Recibo Digital inyectando datos en la plantilla externa
 * Siguiendo el patrón arquitectónico de PocketBike / upay (brandingService)
 */
function renderReceiptHtml(data) {
  let cfg = {};
  try { cfg = appConfig.getConfig(); } catch (_) {}
  const restConfig = cfg.restaurant || {};

  const {
    restaurantName = restConfig.name || 'KEBAB & SHAWARMA',
    storeSubtitle = restConfig.legalName || 'Serviplus Kiosk Express • Estación Centro',
    logoUrl = restConfig.logoUrl || '/images/kebab_brand_banner.png',
    address = restConfig.address || 'Cra. 7 #45-12, Cartagena',
    phone = restConfig.phone || '+57 (300) 123-4567',
    orderNumber = 142,
    orderDate = new Date(),
    transactionRef = 'SP-9ETZEMABAH',
    items = [],
    totalAmount = 10000,
    paymentMethod = 'WOMPI_QR',
    approvalRef = 'M-9482014',
    dianResolution = restConfig.dianResolution || 'Factura Electrónica POS según Res. DIAN No. 187640'
  } = data;

  // Cálculo de Subtotal e IVA (19% en Colombia)
  const totalNum = parseFloat(totalAmount) < 500 ? parseFloat(totalAmount) * 1000 : parseFloat(totalAmount);
  const subtotalNum = Math.round(totalNum / 1.19);
  const ivaNum = totalNum - subtotalNum;

  const formattedDate = formatReceiptDate(orderDate);
  const comandaNumber = `#${String(orderNumber).padStart(4, '0')}`;
  const paymentBadge = resolvePaymentBadge(paymentMethod, approvalRef, totalNum);
  const itemsHtml = buildItemsHtml(items, totalNum);

  // Carga de la plantilla HTML desacoplada (con cache en producción, reload en desarrollo)
  const templatePath = getReceiptTemplatePath();
  if (!cachedReceiptTemplate || process.env.NODE_ENV !== 'production') {
    try {
      cachedReceiptTemplate = fs.readFileSync(templatePath, 'utf8');
    } catch (err) {
      console.error('[ReceiptService] Error reading receipt template:', err.message);
      throw err;
    }
  }

  let html = cachedReceiptTemplate;

  // Reemplazo de marcadores limpios {{KEY}}
  html = html
    .replace(/{{COMPANY_NAME}}/g, restaurantName)
    .replace(/{{STORE_SUBTITLE}}/g, storeSubtitle)
    .replace(/{{COMPANY_LOGO}}/g, logoUrl)
    .replace(/{{ADDRESS}}/g, address)
    .replace(/{{PHONE}}/g, phone)
    .replace(/{{PHONE_RAW}}/g, phone.replace(/\s+/g, ''))
    .replace(/{{COMANDA_NUMBER}}/g, comandaNumber)
    .replace(/{{ORDER_DATE}}/g, formattedDate)
    .replace(/{{TRANSACTION_REF}}/g, transactionRef)
    .replace(/{{DIAN_RESOLUTION}}/g, dianResolution)
    .replace(/{{ITEMS_HTML}}/g, itemsHtml)
    .replace(/{{SUBTOTAL_COP}}/g, formatCOP(subtotalNum))
    .replace(/{{IVA_COP}}/g, formatCOP(ivaNum))
    .replace(/{{TOTAL_NUMBER_FORMATTED}}/g, Math.round(totalNum).toLocaleString('es-CO'))
    .replace(/{{TOTAL_COP}}/g, formatCOP(totalNum))
    .replace(/{{PAYMENT_ICON}}/g, paymentBadge.icon)
    .replace(/{{PAYMENT_BRAND}}/g, paymentBadge.brand)
    .replace(/{{PAYMENT_MODE}}/g, paymentBadge.mode)
    .replace(/{{PAYMENT_ACCOUNT}}/g, paymentBadge.account)
    .replace(/{{PAYMENT_REF_LABEL}}/g, paymentBadge.refLabel)
    .replace(/{{PAYMENT_REF_VAL}}/g, paymentBadge.refVal)
    .replace(/{{PAYMENT_TX_LABEL}}/g, paymentBadge.txLabel)
    .replace(/{{PAYMENT_TX_VAL}}/g, paymentBadge.txVal);

  // Inyección de script con datos iniciales para el cliente
  const initialData = {
    orderNumber,
    comandaNumber,
    transactionRef,
    restaurantName,
    logoUrl,
    address,
    phone,
    totalNum,
    paymentMethod,
    items,
    date: orderDate
  };

  const injectedScript = `<script id="receipt-initial-data">window.__RECEIPT_DATA__ = ${JSON.stringify(initialData)};</script>`;
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${injectedScript}\n</head>`);
  } else {
    html = `${injectedScript}\n${html}`;
  }

  return html;
}

module.exports = {
  generateReceiptCode,
  verifyReceiptCode,
  renderReceiptHtml,
  getReceiptTemplatePath,
  formatCOP,
  formatReceiptDate
};

