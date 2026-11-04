/**
 * Servicio de mensajería WhatsApp vía Meta Graph API Cloud (v25.0)
 */
class WhatsAppService {
  constructor(configGetter) {
    this.getConfig = typeof configGetter === 'function' ? configGetter : () => (configGetter || {});
  }

  /**
   * Envía un mensaje de WhatsApp a través de Meta Graph API
   * @param {string} to - Número de destino con código de país (ej. "573008915869")
   * @param {string} bodyText - Contenido del mensaje de texto
   * @param {object} options - Parámetros opcionales (override de credenciales)
   */
  async sendMessage(to, bodyText, options = {}) {
    const config = this.getConfig() || {};
    const waConfig = config.whatsapp || {};

    const phoneNumberId = options.phoneNumberId || process.env.WA_PHONE_NUMBER_ID || waConfig.phoneNumberId || '';
    const accessToken = options.accessToken || process.env.WA_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || waConfig.accessToken || '';
    const apiVersion = options.apiVersion || waConfig.apiVersion || 'v25.0';

    // Normalizar número telefónico
    let cleanPhone = String(to || '').replace(/\D/g, '');
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      cleanPhone = '57' + cleanPhone;
    }

    if (!cleanPhone) {
      throw new Error('El número telefónico de destino es requerido');
    }

    // Si no están configuradas las credenciales de Meta Cloud API, simular respuesta segura
    if (!phoneNumberId || !accessToken || phoneNumberId === '<PHONE_NUMBER_ID>' || accessToken === '<YOUR_ACCESS_TOKEN>') {
      console.warn(`[WhatsApp Service] Meta WhatsApp Cloud API no configurado (PHONE_NUMBER_ID o ACCESS_TOKEN). Simulación de envío a ${cleanPhone}: "${bodyText}"`);
      return {
        success: true,
        simulated: true,
        to: cleanPhone,
        message: 'Mensaje simulado (configure WA_PHONE_NUMBER_ID y WA_ACCESS_TOKEN en config.json o variables de entorno)'
      };
    }

    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: String(bodyText || '')
      }
    };

    console.log(`[WhatsApp Service] Enviando mensaje a ${cleanPhone} vía ${endpoint}...`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error?.message || `Error en Meta Graph API (HTTP ${response.status})`;
      console.error(`[WhatsApp Service] Error de Meta Graph API (${response.status}):`, data);
      throw new Error(errorMsg);
    }

    console.log(`[WhatsApp Service] Mensaje enviado exitosamente a ${cleanPhone}:`, data);
    return {
      success: true,
      data,
      to: cleanPhone
    };
  }
}

module.exports = WhatsAppService;
