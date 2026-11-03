const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Crockford Base32 (32 caracteres legibles sin ambigüedad)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SECRET_KEY = process.env.RECEIPT_SECRET || 'serviplus_digital_receipts_secret_key_v1';

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

  return {
    txId,
    checksum,
    transactionRef,
    urlCode,
    path: `/p/p/${urlCode}`,
    fullUrl: `https://upaysolutions.app/p/p/${urlCode}`
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

/**
 * Genera el documento HTML completo del Recibo Digital (según el diseño suministrado)
 */
function renderReceiptHtml(data) {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8')); } catch (_) {}
  const restConfig = cfg.restaurant || {};

  const {
    restaurantName = restConfig.name || 'Kebab & Shawarma',
    storeSubtitle = restConfig.legalName || 'Serviplus Kiosk Express • Estación Centro',
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

  // Configuración visual del método de pago
  let paymentBadge = {
    icon: 'QR',
    brand: 'QR Nequi',
    mode: 'Dinámico',
    account: 'Auto-Kiosco • Red Bancolombia / Nequi',
    refLabel: 'Ref. Aprobación',
    refVal: approvalRef,
    txLabel: 'ID Transacción Wompi/Nequi',
    txVal: `NQ-${Math.floor(10000000000 + Math.random() * 90000000000)}`
  };

  const pm = String(paymentMethod).toUpperCase();
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
      refVal: approvalRef,
      txLabel: 'Franquicia',
      txVal: 'VISA / MASTERCARD'
    };
  }

  // Generar HTML de ítems
  const itemsHtml = items.length > 0 ? items.map(item => {
    const qty = item.quantity || 1;
    const name = item.name || item.MenuItemText || 'Producto';
    const rawPrice = item.extendedPrice || item.price || item.unitPrice || 0;
    const price = formatCOP(rawPrice);
    
    // Modificadores
    const mods = item.modifiers || [];
    let modsHtml = '';
    if (mods && mods.length > 0) {
      const modItems = mods.map(m => {
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
  }).join('') : `
    <div class="py-3 border-b border-dashed border-gray-300">
      <div class="flex justify-between items-start text-[14px] font-bold text-gray-900">
        <span>1x Consumo General</span>
        <span class="font-black text-gray-900">${formatCOP(totalNum)}</span>
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" name="viewport">
  <title>Recibo Digital ${comandaNumber} • ${restaurantName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @layer base {
      html, body { width: 100vw; margin: 0; padding: 0; }
      body { overscroll-behavior: none; }
      .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
      .pt-safe { padding-top: env(safe-area-inset-top, 0px); }
    }
    ::-webkit-scrollbar { display: none; }
    @media print {
      header, .no-print { display: none !important; }
      main { padding: 0 !important; background: white !important; }
      body { background: white !important; }
    }
  </style>
</head>
<body class="bg-[#eaedf0] font-['Plus_Jakarta_Sans',sans-serif] text-gray-900 antialiased flex flex-col min-h-screen">

  <!-- Barra Superior de Navegación -->
  <header class="fixed top-0 w-full z-50 pt-safe bg-[#191c1e] text-white flex items-center justify-between px-4 h-12 shadow-md border-b border-white/10 no-print">
    <button aria-label="Volver" onclick="window.history.length > 1 ? window.history.back() : window.location.href='/'" class="p-1 text-gray-200 hover:text-white rounded-full flex items-center justify-center">
      <span class="material-symbols-outlined text-[20px]">arrow_back</span>
    </button>
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-[#ffbc0d] inline-block animate-pulse"></span>
      <span class="font-bold text-[14px] tracking-wide text-white">Recibo Digital • Serviplus</span>
    </div>
    <button aria-label="Compartir" onclick="shareReceipt()" class="p-1 text-gray-200 hover:text-white rounded-full flex items-center justify-center">
      <span class="material-symbols-outlined text-[20px]">share</span>
    </button>
  </header>

  <!-- Contenido Principal -->
  <main class="flex flex-col relative w-full pt-14 pb-safe bg-[#eaedf0] min-h-screen px-3">
    <div class="w-full max-w-[420px] mx-auto pt-2 pb-12 flex flex-col items-stretch">
      <div class="w-full shadow-2xl rounded-t-sm overflow-hidden flex flex-col">

        <!-- Encabezado de Marca -->
        <div class="bg-gradient-to-b from-[#191c1e] via-[#242b30] to-[#1c2227] text-white pt-6 pb-6 px-5 flex flex-col items-center text-center relative overflow-hidden">
          <div class="w-24 h-24 rounded-full overflow-hidden mb-3 border-2 border-amber-400/90 shadow-xl bg-black/60 p-1 flex items-center justify-center">
            <img src="/images/kebab_logo.png" alt="Logo Kebab" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.src='/images/kebab_clean.png';" />
          </div>
          <div class="flex items-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[#ffbc0d] text-[18px]">verified</span>
            <h2 class="text-[19px] font-extrabold text-white tracking-tight">${restaurantName}</h2>
          </div>
          <p class="text-[11px] font-semibold text-amber-300/90 tracking-wide uppercase">${storeSubtitle}</p>
          
          <div class="flex flex-col items-center text-[12px] font-medium text-gray-300 leading-tight gap-1 pt-2">
            <span class="flex items-center gap-1 text-gray-300">
              <span class="material-symbols-outlined text-[14px] text-[#ffbc0d]">location_on</span>
              ${address}
            </span>
            <a href="tel:${phone.replace(/\s+/g, '')}" class="text-amber-400 hover:underline flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">call</span> ${phone}
            </a>
          </div>
        </div>

        <!-- Cuerpo del Recibo Térmico -->
        <div class="bg-white text-gray-800 px-6 pt-5 pb-3">

          <!-- Encabezado de la Tabla de Productos -->
          <div class="flex items-center justify-between pb-2 border-b border-gray-200 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Cant. / Producto</span>
            <span>Importe</span>
          </div>

          <!-- Listado de Ítems -->
          ${itemsHtml}

          <!-- Totales e Impuestos -->
          <div class="pt-3 pb-1 flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-[13px] text-gray-600">
              <span>Subtotal Base Gravable</span>
              <span class="font-semibold text-gray-800">${formatCOP(subtotalNum)} COP</span>
            </div>
            <div class="flex justify-between items-center text-[13px] text-gray-600">
              <span>IVA Discriminado (19%)</span>
              <span class="font-semibold text-gray-800">${formatCOP(ivaNum)} COP</span>
            </div>
          </div>

          <div class="w-full border-b border-dotted border-gray-400 my-2"></div>

          <!-- Total Destacado -->
          <div class="flex items-baseline justify-between py-2.5 bg-amber-50/70 px-3.5 rounded-lg border border-amber-300/80">
            <div class="flex flex-col">
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">Total a Pagar</span>
              <span class="text-[24px] font-black text-gray-900 tracking-tight leading-none">TOTAL</span>
            </div>
            <div class="flex items-baseline text-right">
              <span class="text-[18px] font-bold text-gray-900 mr-1">$</span>
              <span class="text-[36px] font-black leading-none tracking-tight text-gray-900">${Math.round(totalNum).toLocaleString('es-CO')}</span>
              <span class="text-[13px] font-bold text-gray-600 ml-1.5 self-start pt-1">COP</span>
            </div>
          </div>

          <div class="w-full border-b border-dotted border-gray-400 my-3"></div>

          <!-- Método de Pago -->
          <div class="py-2.5 px-3 bg-gradient-to-b from-[#200020]/5 to-pink-50/40 rounded-lg border border-[#300030]/20 flex flex-col gap-2">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 bg-[#191c1e] rounded-lg flex items-center justify-center text-white shadow-sm border border-[#ffbc0d]/40 relative overflow-hidden flex-shrink-0">
                  <span class="font-black text-[13px] tracking-tight text-[#ffbc0d]">${paymentBadge.icon}</span>
                </div>
                <div class="flex flex-col leading-tight">
                  <div class="flex items-center gap-1.5">
                    <span class="font-extrabold text-gray-900 text-[13px] tracking-tight">${paymentBadge.brand}</span>
                    <span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase">${paymentBadge.mode}</span>
                  </div>
                  <span class="text-[11px] font-semibold text-gray-600 mt-0.5">${paymentBadge.account}</span>
                </div>
              </div>
              <div class="text-right flex flex-col items-end">
                <span class="font-black text-[14px] text-gray-900 block">${formatCOP(totalNum)}</span>
                <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase mt-0.5 flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[11px] text-emerald-600">check_circle</span> EXITOSO
                </span>
              </div>
            </div>
            <div class="pt-1.5 border-t border-dashed border-gray-200 grid grid-cols-2 gap-1 text-[10px] text-gray-500 font-mono">
              <div class="flex flex-col">
                <span class="text-[9px] uppercase tracking-wider text-gray-400 font-sans font-bold">${paymentBadge.refLabel}</span>
                <span class="font-bold text-gray-800">${paymentBadge.refVal}</span>
              </div>
              <div class="flex flex-col text-right">
                <span class="text-[9px] uppercase tracking-wider text-gray-400 font-sans font-bold">${paymentBadge.txLabel}</span>
                <span class="font-bold text-gray-800 truncate">${paymentBadge.txVal}</span>
              </div>
            </div>
          </div>

          <div class="w-full border-b border-dotted border-gray-400 my-3"></div>

          <!-- Metadatos de la Comanda -->
          <div class="text-center text-[12px] text-gray-600 leading-snug py-1">
            <p class="text-gray-800 font-semibold">${formattedDate}</p>
            <p class="mt-0.5">Comanda: <span class="font-bold text-gray-900">${comandaNumber}</span> &nbsp;|&nbsp; Transacción: <span class="font-mono font-bold text-gray-900">${transactionRef}</span></p>
            <p class="mt-0.5 text-gray-500 text-[11px]">${dianResolution}</p>
          </div>

          <!-- Botones de Acción -->
          <div class="pt-4 flex flex-col gap-2 no-print">
            <div class="grid grid-cols-2 gap-2">
              <button onclick="window.print()" class="w-full py-2.5 px-3 bg-gray-900 hover:bg-black text-white font-bold text-[12px] rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition">
                <span class="material-symbols-outlined text-[16px]">print</span>
                Guardar / Imprimir
              </button>
              <button onclick="shareReceipt()" class="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[12px] rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition">
                <span class="material-symbols-outlined text-[16px]">share</span>
                Compartir
              </button>
            </div>
          </div>

          <div class="w-full h-[1px] bg-gray-200 mt-4 mb-3"></div>

          <!-- Pie de Página de Serviplus -->
          <div class="pt-1 pb-2 text-center flex flex-col items-center">
            <div class="flex items-center gap-1.5 justify-center mb-1">
              <div class="w-5 h-5 rounded-full bg-[#ffbc0d] flex items-center justify-center text-[#191c1e] font-black text-[11px] shadow-sm">S</div>
              <span class="font-extrabold text-[13px] tracking-tight text-gray-800">Serviplus</span>
              <span class="text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">Kiosk &amp; KDS</span>
            </div>
            <p class="text-[11px] text-gray-500">Sistema de Autoatención y Facturación Digital</p>
            <p class="text-[10px] text-gray-400 font-mono mt-1">${transactionRef}</p>
          </div>

        </div>

        <!-- Borde inferior dentado del recibo térmico -->
        <div class="w-full h-4 bg-white relative" style="background-image: radial-gradient(circle at 10px 0px, transparent 8px, rgb(255, 255, 255) 8px); background-size: 16px 16px; transform: rotate(180deg);"></div>
      </div>
    </div>
  </main>

  <script>
    function shareReceipt() {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: 'Recibo Digital ${comandaNumber}',
          text: 'Comprobante de compra en ${restaurantName} (${comandaNumber})',
          url: url
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url).then(() => {
          alert('¡Enlace del recibo copiado al portapapeles!');
        }).catch(() => {
          prompt('Copia este enlace de tu recibo:', url);
        });
      }
    }
  </script>
</body>
</html>`;
}

module.exports = {
  generateReceiptCode,
  verifyReceiptCode,
  renderReceiptHtml,
  formatCOP,
  formatReceiptDate
};

