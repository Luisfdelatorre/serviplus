const https = require('https');

/**
 * Servicio de mensajería WhatsApp vía Meta Graph API Cloud (v25.0)
 * Compatible con todas las versiones de Node.js (Node 16+)
 */
class WhatsAppService {
  constructor(configGetter) {
    this.getConfig = typeof configGetter === 'function' ? configGetter : () => (configGetter || {});
  }

  /**
   * Envía un mensaje de WhatsApp a través de Meta Graph API
   * @param {string} to - Número de destino con código de país (ej. "573008915869" o "17874096730")
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
    } else if (cleanPhone.length === 10 && (cleanPhone.startsWith('787') || cleanPhone.startsWith('939'))) {
      cleanPhone = '1' + cleanPhone;
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

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: String(bodyText || '')
      }
    });

    const path = `/${apiVersion}/${phoneNumberId}/messages`;
    console.log(`[WhatsApp Service] Enviando mensaje a ${cleanPhone} vía https://graph.facebook.com${path}...`);

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'graph.facebook.com',
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
      }, (res) => {
        let resData = '';
        res.on('data', (chunk) => { resData += chunk; });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(resData);
          } catch (_) {
            parsed = { raw: resData };
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[WhatsApp Service] Mensaje enviado exitosamente a ${cleanPhone} (HTTP ${res.statusCode}):`, parsed);
            resolve({
              success: true,
              data: parsed,
              to: cleanPhone
            });
          } else {
            const errorMsg = parsed?.error?.message || `Error en Meta Graph API (HTTP ${res.statusCode})`;
            console.error(`[WhatsApp Service] Error de Meta Graph API (${res.statusCode}):`, parsed);
            reject(new Error(errorMsg));
          }
        });
      });

      req.on('error', (err) => {
        console.error('[WhatsApp Service] Error de conexión con graph.facebook.com:', err.message);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de conexión al conectar con Meta Graph API'));
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = WhatsAppService;
