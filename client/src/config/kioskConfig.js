/**
 * ARCHIVO DE CONFIGURACIÓN CENTRALIZADA DEL KIOSCO (Serviplus POS)
 * ================================================================
 * Centraliza tiempos de espera (timeouts), valores por defecto,
 * parámetros fiscales/restaurante, validaciones y reglas de negocio
 * para evitar valores numéricos y cadenas quemadas (magic numbers/strings).
 */

export const KIOSK_CONFIG = {
  // -------------------------------------------------------------
  // 1. TEMPORIZADORES Y TIEMPOS DE ESPERA (Segundos y Milisegundos)
  // -------------------------------------------------------------
  timeouts: {
    /** Segundos de inactividad global antes de regresar a la pantalla de bienvenida */
    idleTimeoutSeconds: 90,

    /** Segundos de advertencia antes de reiniciar por inactividad */
    idleWarningSeconds: 15,

    /**
     * Segundos en la pantalla de éxito (Paso 5) antes de cerrar automáticamente la orden.
     * (Equivale al valor de secondsRemaining en CheckoutModal)
     */
    orderSuccessAutoCloseSeconds: 20,

    /** Segundos de gracia tras enviar comprobante por WhatsApp o SMS antes de finalizar */
    receiptSentAutoCloseSeconds: 5,

    /** Retardo en milisegundos para transiciones suaves de pasos táctiles */
    stepTransitionDelayMs: 180,

    /** Intervalo de polling (ms) para verificar estado de pago Wompi QR como respaldo a WebSocket */
    wompiPollIntervalMs: 2500,

    /** Duración en pantalla de notificaciones tipo Toast (ms) */
    toastTimeoutMs: 3500,
  },

  // -------------------------------------------------------------
  // 2. PARÁMETROS Y VALORES POR DEFECTO DEL PEDIDO
  // -------------------------------------------------------------
  orderDefaults: {
    /** Tipo de servicio inicial: 'EAT_IN' (Comer aquí) o 'TAKE_OUT' (Para llevar) */
    defaultOrderType: 'EAT_IN',

    /** Método de pago seleccionado por defecto: 'WOMPI_QR' */
    defaultPaymentMethod: 'WOMPI_QR',

    /** ID del empleado cajero/kiosco asignado en Aldelo POS */
    defaultEmployeeId: 1,

    /** Correo electrónico ficticio/técnico enviado a Wompi si el cliente no lo suministra */
    defaultCustomerEmail: 'kiosco@serviplus.pos',

    /** Pestaña de factura digital activa por defecto: 'qr' | 'whatsapp' | 'sms' */
    defaultReceiptTab: 'qr',

    /** Moneda oficial */
    currency: 'COP',
  },

  // -------------------------------------------------------------
  // 3. VALIDACIÓN Y FORMATO DE ENTRADAS (Teléfonos, Documentos)
  // -------------------------------------------------------------
  validation: {
    /** Longitud mínima de teléfono celular colombiano */
    phoneMinLength: 7,

    /** Longitud estándar de celular */
    phoneMaxLength: 10,

    /** Código de país telefónico para WhatsApp y SMS */
    defaultCountryCode: '57',

    /** Prefijo visual con signo más */
    phonePrefix: '+57',
  },

  // -------------------------------------------------------------
  // 4. IDENTIDAD Y DATOS FISCALES DEL RESTAURANTE
  // -------------------------------------------------------------
  restaurant: {
    name: 'SERVIPLUS RESTAURANTE',
    legalName: 'Serviplus SAS',
    nit: '901.234.567-8',
    address: 'Calle 72 # 45-12, Bogotá',
    phone: '+57 300 123 4567',
    logoUrl: '/images/kebab_logo.png',
    logoEmoji: '🥙',
    dianResolution: 'Resolución DIAN No. 18764000001 del 2024',
    receiptFooter: '¡Gracias por tu compra! Conserva este ticket para retirar tu pedido en mostrador.',
  },

  // -------------------------------------------------------------
  // 5. PLANTILLAS DE MENSAJES SALIENTES
  // -------------------------------------------------------------
  messages: {
    /**
     * Genera el texto del mensaje para enviar factura por WhatsApp
     */
    whatsappTemplate: (orderNumber, receiptUrl, storeName = 'Serviplus Restaurante') => {
      return (
        `¡Hola! 👋 Aquí tienes el comprobante de tu pedido #${orderNumber} en ${storeName}:\n\n` +
        `🔗 ${receiptUrl}\n\n` +
        `¡Gracias por tu compra!`
      );
    },

    /**
     * Genera el texto del mensaje para SMS (Hablame)
     */
    smsTemplate: (orderNumber, receiptUrl, storeName = 'Serviplus') => {
      return `Gracias por tu compra en ${storeName}. Tu factura digital #${orderNumber}: ${receiptUrl}`;
    },
  },
};

/**
 * Función opcional para sincronizar la configuración con datos del backend
 * @param {Object} serverConfig Datos obtenidos de /api/config/public o /api/admin/config
 */
export function updateKioskConfig(serverConfig) {
  if (!serverConfig) return;

  if (serverConfig.restaurant) {
    if (serverConfig.restaurant.name) KIOSK_CONFIG.restaurant.name = serverConfig.restaurant.name;
    if (serverConfig.restaurant.nit) KIOSK_CONFIG.restaurant.nit = serverConfig.restaurant.nit;
    if (serverConfig.restaurant.address) KIOSK_CONFIG.restaurant.address = serverConfig.restaurant.address;
    if (serverConfig.restaurant.phone) KIOSK_CONFIG.restaurant.phone = serverConfig.restaurant.phone;
    if (serverConfig.restaurant.receiptFooter) KIOSK_CONFIG.restaurant.receiptFooter = serverConfig.restaurant.receiptFooter;
  }

  if (serverConfig.kiosk) {
    if (serverConfig.kiosk.idleTimeoutSeconds) KIOSK_CONFIG.timeouts.idleTimeoutSeconds = serverConfig.kiosk.idleTimeoutSeconds;
    if (serverConfig.kiosk.idleWarningSeconds) KIOSK_CONFIG.timeouts.idleWarningSeconds = serverConfig.kiosk.idleWarningSeconds;
    if (serverConfig.kiosk.orderSuccessAutoCloseSeconds) KIOSK_CONFIG.timeouts.orderSuccessAutoCloseSeconds = serverConfig.kiosk.orderSuccessAutoCloseSeconds;
    if (serverConfig.kiosk.receiptSentAutoCloseSeconds) KIOSK_CONFIG.timeouts.receiptSentAutoCloseSeconds = serverConfig.kiosk.receiptSentAutoCloseSeconds;
    if (serverConfig.kiosk.wompiPollIntervalMs) KIOSK_CONFIG.timeouts.wompiPollIntervalMs = serverConfig.kiosk.wompiPollIntervalMs;
    if (serverConfig.kiosk.stepTransitionDelayMs) KIOSK_CONFIG.timeouts.stepTransitionDelayMs = serverConfig.kiosk.stepTransitionDelayMs;
  }
}

export default KIOSK_CONFIG;

