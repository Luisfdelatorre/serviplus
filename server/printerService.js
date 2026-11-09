const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execSync } = require('child_process');
const { renderRtfFile } = require('./rtfTemplate');

const appConfig = require('./config');

// Helper para leer la configuración centralizada (config.json + .env)
function getConfig() {
  return appConfig.getConfig();
}

// Helper para guardar únicamente la sección de impresora
function savePrinterSection(printerSettings) {
  try {
    appConfig.saveConfig({ printer: printerSettings });
    return true;
  } catch (e) {
    console.error('[PrinterService] Error saving config.json:', e.message);
    return false;
  }
}

// Ruta al ejecutable compilado nativo de Windows RawPrint
const appPaths = require('./lib/appPaths');
const RAWPRINT_EXE = appPaths.RAWPRINT_EXE;

// Constantes ESC/POS
const ESC = 0x1B;
const GS = 0x1D;

class EscPosBuilder {
  constructor(paperWidth = 58) {
    this.width = paperWidth === 80 ? 48 : 32; // Columnas máximas por línea
    this.buffers = [];
    this.init();
  }

  // Inicializar impresora
  init() {
    this.buffers.push(Buffer.from([ESC, 0x40])); // ESC @
    this.buffers.push(Buffer.from([ESC, 0x74, 0x02])); // Select PC850 (Multilingual)
    return this;
  }

  // Alineación: 'left' | 'center' | 'right'
  align(alignment = 'left') {
    const n = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffers.push(Buffer.from([ESC, 0x61, n])); // ESC a n
    return this;
  }

  // Negrita
  bold(enable = true) {
    this.buffers.push(Buffer.from([ESC, 0x45, enable ? 1 : 0])); // ESC E n
    return this;
  }

  // Tamaño de texto: 'normal' | 'double-height' | 'double-width' | 'double'
  size(mode = 'normal') {
    let n = 0x00;
    if (mode === 'double') n = 0x11; // 2x ancho y 2x alto
    else if (mode === 'double-height') n = 0x01;
    else if (mode === 'double-width') n = 0x10;
    this.buffers.push(Buffer.from([GS, 0x21, n])); // GS ! n
    return this;
  }

  // Subrayado
  underline(enable = true) {
    this.buffers.push(Buffer.from([ESC, 0x2D, enable ? 1 : 0]));
    return this;
  }

  // Normalizar acentos y caracteres especiales para ESC/POS térmico
  normalizeText(text) {
    if (!text) return '';
    return String(text)
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
      .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
      .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[^\x20-\x7E\r\n\t]/g, ''); // Mantener caracteres ASCII seguros
  }

  // Imprimir línea de texto simple
  line(text = '') {
    const safe = this.normalizeText(text);
    this.buffers.push(Buffer.from(safe + '\r\n', 'ascii'));
    return this;
  }

  // Imprimir texto sin salto de línea
  text(str = '') {
    const safe = this.normalizeText(str);
    this.buffers.push(Buffer.from(safe, 'ascii'));
    return this;
  }

  // Avance de línea
  feed(lines = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffers.push(Buffer.from('\r\n', 'ascii'));
    }
    return this;
  }

  // Separador continuo
  separator(char = '=') {
    this.align('center');
    this.buffers.push(Buffer.from(char.repeat(this.width) + '\r\n', 'ascii'));
    return this;
  }

  // Fila de dos columnas (Izquierda y Derecha justificadas a los extremos)
  twoColumn(leftText, rightText, filler = ' ') {
    const left = this.normalizeText(leftText || '');
    const right = this.normalizeText(rightText || '');
    const maxLen = this.width;

    if ((left.length + right.length + 1) <= maxLen) {
      const spaces = Math.max(1, maxLen - left.length - right.length);
      this.line(left + filler.repeat(spaces) + right);
    } else {
      // Si excede el ancho, cortar o separar en 2 líneas
      const allowedLeft = Math.max(1, maxLen - right.length - 2);
      const shortLeft = left.substring(0, allowedLeft);
      const spaces = Math.max(1, maxLen - shortLeft.length - right.length);
      this.line(shortLeft + filler.repeat(spaces) + right);
    }
    return this;
  }

  // Fila de tres columnas (Cant, Descripción, Total)
  threeColumn(col1, col2, col3) {
    const c1 = this.normalizeText(col1 || '').padEnd(3, ' ');
    const c3 = this.normalizeText(col3 || '').padStart(9, ' ');
    const availCol2 = this.width - c1.length - c3.length - 1;
    let c2 = this.normalizeText(col2 || '');
    if (c2.length > availCol2) {
      c2 = c2.substring(0, availCol2);
    } else {
      c2 = c2.padEnd(availCol2, ' ');
    }
    this.line(`${c1} ${c2}${c3}`);
    return this;
  }

  // Código QR nativo ESC/POS (Function 165 - 181)
  qr(data, size = 4) {
    if (!data) return this;
    const qrData = Buffer.from(String(data), 'ascii');
    const pL = (qrData.length + 3) & 0xFF;
    const pH = ((qrData.length + 3) >> 8) & 0xFF;

    this.align('center');

    // 1. Set QR Model 2
    this.buffers.push(Buffer.from([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
    // 2. Set module size (1-16)
    const qrSize = Math.max(2, Math.min(8, size));
    this.buffers.push(Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, qrSize]));
    // 3. Set error correction level M (49)
    this.buffers.push(Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]));
    // 4. Store data
    this.buffers.push(Buffer.from([GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]));
    this.buffers.push(qrData);
    // 5. Print QR Code
    this.buffers.push(Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]));
    this.feed(1);

    return this;
  }

  // Pulso de apertura para cajón monedero (kick drawer)
  openCashDrawer() {
    this.buffers.push(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA])); // Pin 2
    this.buffers.push(Buffer.from([ESC, 0x70, 0x01, 0x19, 0xFA])); // Pin 5
    return this;
  }

  // Corte de papel
  cut(partial = true) {
    this.feed(3);
    const m = partial ? 0x42 : 0x41;
    this.buffers.push(Buffer.from([GS, 0x56, m, 0x00])); // GS V m n
    return this;
  }

  // Retorna el buffer binario final listo para enviar a la impresora
  toBuffer() {
    return Buffer.concat(this.buffers);
  }
}

class PrinterService {
  constructor() {
    this.ensureRawPrintExecutable();
  }

  // Asegura que rawprint.exe existe o lo compila de inmediato con csc.exe.
  // En builds empaquetados rawprint.exe ya viene compilado: nunca se invoca csc.exe en runtime.
  ensureRawPrintExecutable() {
    if (appPaths.IS_PACKAGED) return;
    if (!fs.existsSync(RAWPRINT_EXE)) {
      try {
        console.log('[PrinterService] Compilando helper rawprint.exe con csc.exe...');
        const csPath = path.join(__dirname, 'rawprint.cs');
        if (fs.existsSync(csPath)) {
          execSync(`C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /nologo /target:exe /out:"${RAWPRINT_EXE}" /r:System.Drawing.dll "${csPath}"`, { stdio: 'pipe' });
          console.log('[PrinterService] rawprint.exe compilado con éxito.');
        }
      } catch (err) {
        console.error('[PrinterService] Error compilando rawprint.exe:', err.message);
      }
    }
  }


  // Obtener configuración de impresora con defaults
  getPrinterConfig() {
    const cfg = getConfig();
    const rest = cfg.restaurant || {};
    const prn = cfg.printer || {};

    return {
      enabled: prn.enabled !== undefined ? Boolean(prn.enabled) : true,
      printerName: prn.printerName || 'POS-58',
      kitchenPrinterName: prn.kitchenPrinterName || prn.printerName || 'POS-58',
      barPrinterName: prn.barPrinterName || '',
      paperWidth: Number(prn.paperWidth) === 80 ? 80 : 58,
      kitchenPaperWidth: Number(prn.kitchenPaperWidth) === 80 ? 80 : 58,
      autoPrintOrder: prn.autoPrintOrder !== undefined ? Boolean(prn.autoPrintOrder) : true,
      autoPrintKitchen: prn.autoPrintKitchen !== undefined ? Boolean(prn.autoPrintKitchen) : false,
      autoPrintCashShift: prn.autoPrintCashShift !== undefined ? Boolean(prn.autoPrintCashShift) : true,
      printCustomerReceipt: prn.printCustomerReceipt !== undefined ? Boolean(prn.printCustomerReceipt) : true,
      printKitchenComanda: prn.printKitchenComanda !== undefined ? Boolean(prn.printKitchenComanda) : true,
      printDigitalReceiptQr: prn.printDigitalReceiptQr !== undefined ? Boolean(prn.printDigitalReceiptQr) : true,
      openCashDrawer: prn.openCashDrawer !== undefined ? Boolean(prn.openCashDrawer) : false,
      copies: Math.max(1, parseInt(prn.copies, 10) || 1),
      feedLines: Math.max(1, parseInt(prn.feedLines, 10) || 3),
      cutPaper: prn.cutPaper !== undefined ? Boolean(prn.cutPaper) : true,
      customHeader: prn.customHeader || '',
      customFooter: prn.customFooter || '¡Gracias por su compra!',
      restaurantName: rest.name || 'KEBAB & SHAWARMA',
      restaurantNit: rest.nit || 'NIT: 901.234.567-8',
      restaurantAddress: rest.address || 'Calle 72 # 45-12, Bogotá',
      restaurantPhone: rest.phone || '+57 300 123 4567',
      dianResolution: rest.dianResolution || 'Factura POS según Resolución DIAN'
    };
  }

  // Actualizar configuración en config.json
  updatePrinterConfig(newSettings) {
    const ok = savePrinterSection({ ...(newSettings || {}) });
    return { success: ok, data: this.getPrinterConfig() };
  }

  // Listar impresoras instaladas en Windows
  async listInstalledPrinters() {
    return new Promise((resolve) => {
      // 1. Intentar con rawprint.exe --list
      if (fs.existsSync(RAWPRINT_EXE)) {
        execFile(RAWPRINT_EXE, ['--list'], (err, stdout) => {
          if (!err && stdout) {
            const list = stdout
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (list.length > 0) {
              return resolve({ success: true, printers: list });
            }
          }
          // 2. Fallback a PowerShell Get-Printer
          this.listPrintersPowerShell(resolve);
        });
      } else {
        this.listPrintersPowerShell(resolve);
      }
    });
  }

  listPrintersPowerShell(resolve) {
    const psCmd = 'Get-Printer | Select-Object -ExpandProperty Name';
    execFile('powershell.exe', ['-NoProfile', '-Command', psCmd], (psErr, psStdout) => {
      if (psErr || !psStdout) {
        return resolve({
          success: false,
          printers: ['POS-58', 'Microsoft Print to PDF'],
          error: psErr ? psErr.message : 'No se pudo listar impresoras'
        });
      }
      const list = psStdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      resolve({ success: true, printers: list });
    });
  }

  // Comprobar estado de la impresora configurada
  async getPrinterStatus() {
    const config = this.getPrinterConfig();
    const listResult = await this.listInstalledPrinters();
    const isInstalled = listResult.printers.some(
      (p) => p.toLowerCase() === config.printerName.toLowerCase()
    );

    let isOnline = false;
    let jobCount = 0;
    try {
      const psStatus = `Get-Printer -Name '${config.printerName}' -ErrorAction SilentlyContinue | Select-Object -Property PrinterStatus, WorkOffline, @{Name='Jobs';Expression={(Get-PrintJob -PrinterName '${config.printerName}' -ErrorAction SilentlyContinue | Measure-Object).Count}} | ConvertTo-Json`;
      const out = execSync(`powershell.exe -NoProfile -Command "${psStatus}"`, { encoding: 'utf8', timeout: 3000 });
      if (out) {
        const info = JSON.parse(out);
        isOnline = !info.WorkOffline;
        jobCount = info.Jobs || 0;
      }
    } catch (_) {
      isOnline = isInstalled;
    }

    return {
      configuredPrinter: config.printerName,
      isInstalled,
      isOnline,
      jobCount,
      paperWidth: config.paperWidth,
      autoPrintOrder: config.autoPrintOrder,
      autoPrintKitchen: config.autoPrintKitchen,
      installedPrinters: listResult.printers
    };
  }

  // Enviar buffer binario directamente a la impresora mediante rawprint.exe
  async printBuffer(buffer, printerName = null) {
    const config = this.getPrinterConfig();
    const targetPrinter = printerName || config.printerName;

    return new Promise((resolve, reject) => {
      this.ensureRawPrintExecutable();

      if (!fs.existsSync(RAWPRINT_EXE)) {
        return reject(new Error('rawprint.exe no está disponible en el servidor'));
      }

      // Escribir archivo temporal seguro para el spooler
      const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.bin`);
      try {
        fs.writeFileSync(tempFile, buffer);
      } catch (writeErr) {
        return reject(writeErr);
      }

      execFile(RAWPRINT_EXE, [targetPrinter, tempFile], (err, stdout, stderr) => {
        // Limpiar archivo temporal
        try { fs.unlinkSync(tempFile); } catch (_) { }

        if (err) {
          console.error(`[PrinterService] Error al imprimir en ${targetPrinter}:`, stderr || err.message);
          return reject(new Error(`Fallo de impresión en '${targetPrinter}': ${stderr || err.message}`));
        }

        console.log(`[PrinterService] Impresión exitosa en '${targetPrinter}': ${stdout.trim()}`);
        resolve({
          success: true,
          printer: targetPrinter,
          bytes: buffer.length,
          output: stdout.trim()
        });
      });
    });
  }

  // Abrir cajón monedero
  async openCashDrawer(printerName = null) {
    const config = this.getPrinterConfig();
    const builder = new EscPosBuilder(config.paperWidth);
    builder.openCashDrawer();
    return this.printBuffer(builder.toBuffer(), printerName || config.printerName);
  }

  // Generar e imprimir Ticket de Prueba de Diagnóstico
  async printTestTicket(printerName = null) {
    const config = this.getPrinterConfig();
    const target = printerName || config.printerName;
    const builder = new EscPosBuilder(config.paperWidth);
    const now = new Date();

    builder
      .align('center')
      .size('double')
      .bold(true)
      .line(config.restaurantName)
      .size('normal')
      .bold(false)
      .line(config.restaurantNit)
      .line(config.restaurantAddress)
      .line(`Tel: ${config.restaurantPhone}`)
      .feed(1)
      .separator('=')
      .size('double-height')
      .bold(true)
      .line('** PRUEBA DE IMPRESION **')
      .size('normal')
      .bold(false)
      .separator('=')
      .align('left')
      .twoColumn('Fecha:', now.toLocaleDateString('es-CO'))
      .twoColumn('Hora:', now.toLocaleTimeString('es-CO'))
      .twoColumn('Impresora:', target)
      .twoColumn('Ancho de Papel:', `${config.paperWidth} mm (${builder.width} cols)`)
      .twoColumn('Corte Automatico:', config.cutPaper ? 'Activado' : 'Desactivado')
      .separator('-')
      .align('center')
      .bold(true)
      .line('Prueba de Alineacion y Estilos:')
      .bold(false)
      .align('left')
      .line('[Izquierda] Texto estandar')
      .align('center')
      .line('[Centro] Texto centrado')
      .align('right')
      .line('[Derecha] Texto alineado')
      .separator('-')
      .align('center')
      .bold(true)
      .line('Prueba de Codigo QR Digital:')
      .qr('https://serviplus.upaysolutions.app', 4)
      .line('serviplus.upaysolutions.app')
      .separator('=')
      .align('center')
      .bold(true)
      .line('¡IMPRESION CONFIGURADA!')
      .line('Serviplus POS & Kiosk 2.0')
      .feed(config.feedLines);

    if (config.cutPaper) {
      builder.cut(true);
    }

    return this.printBuffer(builder.toBuffer(), target);
  }

  // Formateador de moneda en pesos colombianos
  formatCOP(num) {
    let val = parseFloat(num) || 0;
    if (val < 500 && val > 0) val = val * 1000;
    return '$' + Math.round(val).toLocaleString('es-CO');
  }

  // Generar Ticket de Venta / Recibo de Cliente
  generateCustomerReceiptBuffer(orderData, customOptions = {}) {
    const config = this.getPrinterConfig();
    const builder = new EscPosBuilder(config.paperWidth);

    const {
      orderId = 1,
      orderNumber = orderId,
      orderType = 'DINE_IN',
      tableId = null,
      tableName = null,
      employeeName = 'Auto-Kiosco',
      createdAt = new Date(),
      items = [],
      total = 0,
      subtotal = 0,
      tax = 0,
      paymentMethod = 'WOMPI_QR',
      receiptCode = null,
      receiptFullUrl = null,
      notes = ''
    } = orderData;

    const dateObj = new Date(createdAt);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${months[dateObj.getMonth()]}/${dateObj.getFullYear()}`;
    const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

    const isEatIn = String(orderType).toUpperCase().includes('EAT') || String(orderType) === '1';
    const serviceLabel = isEatIn ? `Dine In (Mesa ${tableId || tableName || '1'})` : 'Para Llevar / Take Out';

    const totalNum = parseFloat(total) < 500 ? parseFloat(total) * 1000 : parseFloat(total);
    const subtotalCalc = subtotal || Math.round(totalNum / 1.19);
    const taxCalc = tax || (totalNum - subtotalCalc);

    const pmUpper = String(paymentMethod || '').toUpperCase();
    let pmText = 'WOMPI_QR';
    if (pmUpper.includes('CASH') || pmUpper === '1') pmText = 'EFECTIVO';
    else if (pmUpper.includes('CARD') || pmUpper.includes('DATA') || pmUpper === '3') pmText = 'DATAFONO';
    if (orderData.approvalRef) pmText += ` (Aprobado: ${orderData.approvalRef})`;

    const rtfPath = path.join(__dirname, 'templates/receipt_customer.rtf');
    if (fs.existsSync(rtfPath)) {
      try {
        const templateData = {
          RESTAURANT_NAME: config.restaurantName,
          RESTAURANT_ADDRESS: config.restaurantAddress,
          RESTAURANT_NIT: config.restaurantNit,
          RESTAURANT_PHONE: config.restaurantPhone,
          ORDER_NUMBER: String(orderNumber || orderId),
          CASHIER_NAME: employeeName || 'Luis',
          STATION: orderData.stationId || '1',
          ORDER_ID: String(orderId),
          SERVICE_TYPE: serviceLabel,
          ORDER_NOTES: notes || '',
          ITEMS: items.map((it) => {
            const qty = it.quantity || 1;
            const rawP = (it.extendedPrice !== undefined ? it.extendedPrice : (it.price || it.unitPrice || 0)) * qty;
            const mods = (it.modifiers || it.Modifiers || []).map((m) => ({
              name: m.name || m.N || m.MenuModifierText || '',
              price: Number(m.price || m.P || 0) > 0 ? `+${this.formatCOP(Number(m.price || m.P))}` : '$0'
            }));
            const itemNotes = it.notes ? [it.notes] : [];
            return {
              qty,
              name: it.name || it.MenuItemText || 'Producto',
              price: this.formatCOP(rawP),
              mods,
              notes: itemNotes
            };
          }),
          SUBTOTAL: this.formatCOP(subtotalCalc),
          TAX: this.formatCOP(taxCalc),
          TOTAL: this.formatCOP(totalNum),
          ACCOUNT_NUMBER: pmText,
          DATE_TIME: `${dateStr} ${timeStr}`,
          QR_URL: (config.printDigitalReceiptQr && (receiptFullUrl || receiptCode)) ? (receiptFullUrl || `https://serviplus.upaysolutions.app/p/${receiptCode}`) : '',
          RECEIPT_CODE: receiptCode || '',
          DIAN_RESOLUTION: config.dianResolution,
          CUSTOM_FOOTER: config.customFooter
        };

        renderRtfFile(builder, 'receipt_customer.rtf', templateData);
        return builder.toBuffer();
      } catch (rtfErr) {
        console.error('[PrinterService] Error renderizando receipt_customer.rtf, usando fallback:', rtfErr.message);
      }
    }

    // Fallback nativo
    builder
      .align('center')
      .size('double-width')
      .bold(true)
      .line(config.restaurantName)
      .size('normal')
      .bold(false)
      .line(config.restaurantNit)
      .line(config.restaurantAddress)
      .line(`Tel: ${config.restaurantPhone}`);

    if (config.customHeader) {
      builder.line(config.customHeader);
    }

    builder.separator('=');

    const turnFormatted = `#${String(orderNumber || orderId).padStart(4, '0')}`;
    builder
      .size('double')
      .bold(true)
      .line(turnFormatted)
      .size('normal')
      .bold(false)
      .bold(true)
      .line(serviceLabel)
      .bold(false)
      .separator('=')
      .align('left')
      .twoColumn('Fecha:', `${dateStr} ${timeStr}`)
      .twoColumn('Atendido por:', employeeName || 'Kiosco Central')
      .twoColumn('Comprobante No:', `FAC-${orderId}`)
      .separator('-')
      .bold(true)
      .line('CANT  DESCRIPCION         VALOR')
      .bold(false);

    items.forEach((item) => {
      const qty = item.quantity || 1;
      const name = item.name || item.MenuItemText || 'Producto';
      const rawPrice = (item.extendedPrice !== undefined ? item.extendedPrice : (item.price || item.unitPrice || 0)) * qty;
      const priceStr = this.formatCOP(rawPrice);

      builder.twoColumn(`${qty}x ${name}`, priceStr);

      const mods = item.modifiers || item.Modifiers || [];
      if (mods && mods.length > 0) {
        mods.forEach((m) => {
          const mName = m.name || m.N || m.MenuModifierText || '';
          const mPrice = Number(m.price || m.P || 0);
          const mPriceStr = mPrice > 0 ? `+${this.formatCOP(mPrice)}` : '';
          builder.twoColumn(`  + ${mName}`, mPriceStr);
        });
      }

      if (item.notes) {
        builder.line(`  * Nota: ${item.notes}`);
      }
    });

    builder
      .separator('-')
      .twoColumn('SUBTOTAL:', this.formatCOP(subtotalCalc))
      .twoColumn('IVA (19%):', this.formatCOP(taxCalc))
      .separator('=')
      .size('double-height')
      .bold(true)
      .twoColumn('TOTAL A PAGAR:', this.formatCOP(totalNum))
      .size('normal')
      .bold(false)
      .separator('=')
      .align('left')
      .twoColumn('Forma de Pago:', pmText);

    if (notes) {
      builder.separator('-');
      builder.line(`Obs: ${notes}`);
    }

    if (config.printDigitalReceiptQr && (receiptFullUrl || receiptCode)) {
      const qrTarget = receiptFullUrl || `https://serviplus.upaysolutions.app/p/${receiptCode}`;
      builder
        .separator('-')
        .align('center')
        .bold(true)
        .line('VER FACTURA DIGITAL')
        .qr(qrTarget, 4)
        .line(receiptCode ? `Codigo: ${receiptCode}` : '')
        .line('serviplus.upaysolutions.app');
    }

    builder
      .separator('=')
      .align('center')
      .line(config.dianResolution)
      .line(config.customFooter)
      .feed(config.feedLines);

    if (config.cutPaper) {
      builder.cut(true);
    }

    return builder.toBuffer();
  }

  // Generar Comanda de Cocina (Kitchen Ticket)
  generateKitchenComandaBuffer(orderData) {
    const config = this.getPrinterConfig();
    const builder = new EscPosBuilder(config.paperWidth);

    const {
      orderId = 1,
      orderNumber = orderId,
      orderType = 'DINE_IN',
      tableId = null,
      tableName = null,
      createdAt = new Date(),
      items = [],
      notes = ''
    } = orderData;

    const dateObj = new Date(createdAt);
    const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    const isEatIn = String(orderType).toUpperCase().includes('EAT') || String(orderType) === '1';
    const dest = isEatIn ? `MESA #${tableId || tableName || '1'}` : 'PARA LLEVAR (PACK)';

    const rtfPath = path.join(__dirname, 'templates/receipt_kitchen.rtf');
    if (fs.existsSync(rtfPath)) {
      try {
        const templateData = {
          ORDER_NUMBER: String(orderNumber || orderId),
          SERVICE_TYPE: dest,
          TIME: timeStr,
          ORDER_ID: String(orderId),
          STATION: orderData.stationId || '1',
          ORDER_NOTES: notes || '',
          ITEMS: items.map((it) => {
            const qty = it.quantity || 1;
            const mods = (it.modifiers || it.Modifiers || []).map((m) => ({
              name: m.name || m.N || m.MenuModifierText || ''
            }));
            const itemNotes = it.notes ? [it.notes] : [];
            return {
              qty,
              name: it.name || it.MenuItemText || 'Producto',
              mods,
              notes: itemNotes
            };
          })
        };
        renderRtfFile(builder, 'receipt_kitchen.rtf', templateData);
        return builder.toBuffer();
      } catch (rtfErr) {
        console.error('[PrinterService] Error renderizando receipt_kitchen.rtf, usando fallback:', rtfErr.message);
      }
    }

    builder
      .align('center')
      .size('double-height')
      .bold(true)
      .line('*** COCINA / KITCHEN ***')
      .separator('=')
      .size('double')
      .line(`#${String(orderNumber || orderId).padStart(4, '0')}`)
      .size('double-height')
      .line(dest)
      .size('normal')
      .bold(false)
      .separator('=')
      .align('left')
      .twoColumn('Hora Recibido:', timeStr)
      .twoColumn('Ticket ID:', `#${orderId}`)
      .separator('-');

    items.forEach((item) => {
      const qty = item.quantity || 1;
      const name = (item.name || item.MenuItemText || 'Producto').toUpperCase();

      builder
        .size('double-height')
        .bold(true)
        .line(`${qty}x ${name}`)
        .size('normal')
        .bold(false);

      const mods = item.modifiers || item.Modifiers || [];
      if (mods && mods.length > 0) {
        mods.forEach((m) => {
          const mName = (m.name || m.N || m.MenuModifierText || '').toUpperCase();
          builder.bold(true).line(`   >> ${mName}`).bold(false);
        });
      }

      if (item.notes) {
        builder.bold(true).line(`   * NOTA: ${item.notes.toUpperCase()}`).bold(false);
      }
      builder.feed(1);
    });

    if (notes) {
      builder
        .separator('-')
        .bold(true)
        .line(`OBSERVACIONES GENERALES:`)
        .line(notes.toUpperCase())
        .bold(false);
    }

    builder.separator('*').feed(config.feedLines);

    if (config.cutPaper) {
      builder.cut(true);
    }

    return builder.toBuffer();
  }

  // Generar Ticket de Turno de Caja (Apertura o Cierre Z)
  generateCashShiftTicketBuffer(shiftData, isClosing = false) {
    const config = this.getPrinterConfig();
    const builder = new EscPosBuilder(config.paperWidth);
    const now = new Date();

    const title = isClosing ? '*** CIERRE Z DE CAJA ***' : '*** APERTURA DE TURNO ***';

    const rtfPath = path.join(__dirname, 'templates/receipt_shift.rtf');
    if (fs.existsSync(rtfPath)) {
      try {
        let diffStr = 'CUADRADO ($0)';
        let closingNotes = '';
        let expected = 0;
        let actual = 0;
        if (isClosing && shiftData.closing) {
          const c = shiftData.closing;
          expected = shiftData.expectedCash || 0;
          actual = c.actualCashInDrawer || 0;
          const diff = c.discrepancy || (actual - expected);
          if (diff < 0) diffStr = `-${this.formatCOP(Math.abs(diff))} (FALTANTE)`;
          else if (diff > 0) diffStr = `+${this.formatCOP(diff)} (SOBRANTE)`;
          closingNotes = c.notes || '';
        }

        const templateData = {
          RESTAURANT_NAME: config.restaurantName,
          RESTAURANT_NIT: config.restaurantNit,
          SHIFT_TITLE: title,
          DATE: now.toLocaleDateString('es-CO'),
          TIME: now.toLocaleTimeString('es-CO'),
          CASHIER_NAME: shiftData.cashierName || 'Cajero Central',
          SHIFT_ID: shiftData.id || 'SHIFT-01',
          INITIAL_CASH: this.formatCOP(shiftData.initialCash || 0),
          IF_CLOSING: isClosing,
          SALES_CASH: this.formatCOP(shiftData.sales?.cash || 0),
          SALES_QR: this.formatCOP(shiftData.sales?.wompiQr || 0),
          SALES_CARD: this.formatCOP(shiftData.sales?.card || 0),
          SALES_TOTAL: this.formatCOP(shiftData.sales?.total || 0),
          EXPECTED_CASH: this.formatCOP(expected),
          ACTUAL_CASH: this.formatCOP(actual),
          DIFFERENCE: diffStr,
          CLOSING_NOTES: closingNotes
        };
        renderRtfFile(builder, 'receipt_shift.rtf', templateData);
        return builder.toBuffer();
      } catch (rtfErr) {
        console.error('[PrinterService] Error renderizando receipt_shift.rtf, usando fallback:', rtfErr.message);
      }
    }

    builder
      .align('center')
      .size('double-width')
      .bold(true)
      .line(config.restaurantName)
      .size('normal')
      .bold(false)
      .line(config.restaurantNit)
      .separator('=')
      .size('double-height')
      .bold(true)
      .line(title)
      .size('normal')
      .bold(false)
      .separator('=')
      .align('left')
      .twoColumn('Fecha:', now.toLocaleDateString('es-CO'))
      .twoColumn('Hora:', now.toLocaleTimeString('es-CO'))
      .twoColumn('Cajero:', shiftData.cashierName || 'Cajero Central')
      .twoColumn('ID Turno:', shiftData.id || 'SHIFT-01')
      .separator('-');

    // Fondo inicial
    builder.twoColumn('Fondo Inicial de Caja:', this.formatCOP(shiftData.initialCash || 0));

    if (isClosing && shiftData.closing) {
      const c = shiftData.closing;
      const expected = shiftData.expectedCash || 0;
      const actual = c.actualCashInDrawer || 0;
      const diff = c.discrepancy || (actual - expected);

      builder
        .separator('-')
        .bold(true)
        .line('RESUMEN DE VENTAS DEL TURNO:')
        .bold(false)
        .twoColumn('Ventas Efectivo:', this.formatCOP(shiftData.sales?.cash || 0))
        .twoColumn('Ventas Wompi / QR:', this.formatCOP(shiftData.sales?.wompiQr || 0))
        .twoColumn('Ventas Tarjeta/Datafono:', this.formatCOP(shiftData.sales?.card || 0))
        .separator('-')
        .bold(true)
        .twoColumn('TOTAL VENTAS:', this.formatCOP(shiftData.sales?.total || 0))
        .bold(false)
        .separator('=')
        .twoColumn('Efectivo Esperado:', this.formatCOP(expected))
        .twoColumn('Efectivo en Gaveta:', this.formatCOP(actual))
        .separator('-');

      builder
        .size('double-height')
        .bold(true);

      if (diff === 0) {
        builder.twoColumn('DIFERENCIA:', 'CUADRADO ($0)');
      } else if (diff < 0) {
        builder.twoColumn('FALTANTE:', `-${this.formatCOP(Math.abs(diff))}`);
      } else {
        builder.twoColumn('SOBRANTE:', `+${this.formatCOP(diff)}`);
      }

      builder
        .size('normal')
        .bold(false);

      if (c.notes) {
        builder.separator('-').line(`Notas de cierre: ${c.notes}`);
      }
    }

    builder
      .feed(2)
      .separator('-')
      .align('center')
      .line('Firma Cajero: ___________________')
      .feed(1)
      .line('Firma Supervisor: ________________')
      .feed(config.feedLines);

    if (config.cutPaper) {
      builder.cut(true);
    }

    return builder.toBuffer();
  }

  // Imprimir Pedido Completo (con lógica de copias, cocina y gaveta)
  async printOrder(orderData, options = {}) {
    const config = this.getPrinterConfig();
    if (!config.enabled) {
      console.log('[PrinterService] Impresora deshabilitada en configuración. Omitiendo.');
      return { success: false, reason: 'printer_disabled' };
    }

    const {
      type = 'customer', // 'customer' | 'kitchen' | 'both'
      printerName = config.printerName,
      copies = config.copies || 1,
      openDrawer = false
    } = options;

    const results = [];

    // 1. Si es pago en efectivo y está configurado abrir gaveta
    const pmUpper = String(orderData.paymentMethod || '').toUpperCase();
    const isCash = pmUpper.includes('CASH') || pmUpper === '1';
    if ((config.openCashDrawer || openDrawer) && isCash) {
      try {
        await this.openCashDrawer(printerName);
      } catch (drawerErr) {
        console.warn('[PrinterService] Error abriendo gaveta:', drawerErr.message);
      }
    }

    // 2. Imprimir Comanda de Cocina si corresponde
    if (type === 'kitchen' || type === 'both' || (config.autoPrintKitchen && type !== 'customer')) {
      try {
        const targetKitchenPrinter = options.kitchenPrinterName || config.kitchenPrinterName || printerName;
        const kitchenBuf = this.generateKitchenComandaBuffer(orderData);
        const kRes = await this.printBuffer(kitchenBuf, targetKitchenPrinter);
        results.push({ type: 'kitchen', printer: targetKitchenPrinter, ...kRes });
      } catch (kErr) {
        console.error('[PrinterService] Error imprimiendo comanda de cocina:', kErr.message);
        results.push({ type: 'kitchen', success: false, error: kErr.message });
      }
    }

    // 3. Imprimir Recibo de Cliente
    if (type === 'customer' || type === 'both') {
      try {
        const customerBuf = this.generateCustomerReceiptBuffer(orderData, options);
        for (let i = 0; i < copies; i++) {
          const cRes = await this.printBuffer(customerBuf, printerName);
          results.push({ type: 'customer', copy: i + 1, ...cRes });
        }
      } catch (cErr) {
        console.error('[PrinterService] Error imprimiendo recibo de cliente:', cErr.message);
        results.push({ type: 'customer', success: false, error: cErr.message });
      }
    }

    const hasSuccess = results.some((r) => r.success);
    return {
      success: hasSuccess,
      printer: printerName,
      details: results
    };
  }

  // Imprimir Slip de Turno de Caja
  async printCashShift(shiftData, isClosing = false, printerName = null) {
    const config = this.getPrinterConfig();
    const target = printerName || config.printerName;
    const buf = this.generateCashShiftTicketBuffer(shiftData, isClosing);
    return this.printBuffer(buf, target);
  }
}

const printerInstance = new PrinterService();
printerInstance.EscPosBuilder = EscPosBuilder;
module.exports = printerInstance;

