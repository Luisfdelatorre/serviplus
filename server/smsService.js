const https = require('https');
const http = require('http');

/**
 * Servicio de envío de SMS para Recibos Digitales vía Hablame Colombia
 */
class SmsService {
  constructor(configGetter) {
    this.getConfig = typeof configGetter === 'function' ? configGetter : () => configGetter;
  }

  /**
   * Envía un mensaje SMS con el enlace al recibo digital
   * @param {string} destination - Número celular del cliente
   * @param {string} receiptUrl - URL completa del recibo digital
   * @param {object} metadata - Opciones adicionales (nombre restaurante, etc)
   */
  async sendReceiptSms(destination, receiptUrl, metadata = {}) {
    const config = this.getConfig();
    const smsConfig = (config && config.sms) || {};

    if (!smsConfig.enabled) {
      console.log(`[SMS Service] SMS deshabilitado en configuración. Simulado para: ${destination}`);
      return { success: true, simulated: true, destination };
    }

    // Normalizar número telefónico para Colombia (código país 57)
    let cleanPhone = String(destination || '').replace(/\D/g, '');
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      cleanPhone = '57' + cleanPhone;
    }

    if (cleanPhone.length < 10) {
      throw new Error(`Número de celular inválido: ${destination}`);
    }

    const restaurantName = metadata.restaurantName || (config.restaurant && config.restaurant.name) || 'Serviplus';
    let messageText = smsConfig.template || 'Gracias por tu compra en {restaurant}. Tu recibo digital: {url}';
    messageText = messageText.replace('{restaurant}', restaurantName).replace('{url}', receiptUrl);

    // Payload oficial Hablame v3 Priority SMS
    const payload = JSON.stringify({
      toNumber: cleanPhone,
      sms: messageText,
      flash: 0,
      sc: '890001',
      request_dlvr_rcpt: 0
    });

    const apiUrl = smsConfig.apiUrl || 'https://api103.hablame.co/api/sms/v3/send/priority';
    const parsedUrl = new URL(apiUrl);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'account': String(smsConfig.accountId || ''),
          'apiKey': String(smsConfig.apiKey || ''),
          'token': String(smsConfig.token || '')
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          let responseJson = {};
          try { responseJson = JSON.parse(body); } catch (_) { responseJson = { raw: body }; }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[SMS Service] SMS enviado con éxito a ${cleanPhone} (HTTP ${res.statusCode}):`, body);
            resolve({ success: true, response: responseJson });
          } else {
            console.error(`[SMS Service] Error respuesta Hablame (HTTP ${res.statusCode}):`, body);
            resolve({ success: false, error: body, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[SMS Service] Error de conexión con Hablame:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('[SMS Service] Timeout conectando con Hablame');
        resolve({ success: false, error: 'Timeout de conexión con servicio de SMS' });
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = SmsService;
