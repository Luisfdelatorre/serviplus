const crypto = require('crypto');
const https = require('https');

/**
 * Servicio de integración Wompi Bancolombia para Serviplus POS & Kiosk
 * Basado en la arquitectura de producción de PocketBike / webApp2026
 */
class WompiService {
  constructor(configGetter) {
    this.getConfig = typeof configGetter === 'function' ? configGetter : () => configGetter;
  }

  getActiveCredentials() {
    const config = this.getConfig();
    const wompi = (config && config.wompi) || {};
    const isSandbox = wompi.mode === 'sandbox';

    if (isSandbox && wompi.sandbox) {
      return {
        mode: 'sandbox',
        baseUrl: 'https://sandbox.wompi.co/v1',
        publicKey: wompi.sandbox.publicKey || '',
        privateKey: wompi.sandbox.privateKey || '',
        integritySecret: wompi.sandbox.integritySecret || '',
        eventsSecret: wompi.sandbox.eventsSecret || '',
        currency: wompi.currency || 'COP'
      };
    }

    return {
      mode: 'production',
      baseUrl: 'https://production.wompi.co/v1',
      publicKey: wompi.publicKey || '',
      privateKey: wompi.privateKey || '',
      integritySecret: wompi.integritySecret || '',
      eventsSecret: wompi.eventsSecret || '',
      currency: wompi.currency || 'COP'
    };
  }

  /**
   * Genera firma SHA-256 de integridad para una transacción
   */
  generateIntegritySignature(reference, amountInCents, currency = 'COP') {
    const creds = this.getActiveCredentials();
    if (!creds.integritySecret) return '';
    const rawSignature = `${reference}${amountInCents}${currency}${creds.integritySecret}`;
    return crypto.createHash('sha256').update(rawSignature).digest('hex');
  }

  /**
   * Petición HTTPS genérica a la API de Wompi
   */
  async request(method, path, body = null, usePrivateKey = false) {
    const creds = this.getActiveCredentials();
    const authKey = usePrivateKey ? creds.privateKey : creds.publicKey;
    const url = new URL(path, creds.baseUrl);

    const payload = body ? JSON.stringify(body) : null;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers: {
          'Authorization': `Bearer ${authKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      };

      if (payload) {
        options.headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (d) => { responseBody += d; });
        res.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            resolve({ statusCode: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
          } catch (e) {
            resolve({ statusCode: res.statusCode, ok: false, data: { raw: responseBody } });
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Wompi connection error: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Wompi request timeout (15s)'));
      });

      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Obtiene el acceptance token obligatorio para crear transacciones
   */
  async getAcceptanceToken() {
    const creds = this.getActiveCredentials();
    if (!creds.publicKey) {
      throw new Error('Falta configurar la Llave Pública de Wompi.');
    }

    const res = await this.request('GET', `/merchants/${creds.publicKey}`);
    if (!res.ok || !res.data?.data?.presigned_acceptance?.acceptance_token) {
      throw new Error((res.data && res.data.error && res.data.error.reason) || 'No se pudo obtener acceptance token de Wompi');
    }
    return res.data.data.presigned_acceptance.acceptance_token;
  }

  /**
   * Crea una transacción Wompi generando el código QR de Bancolombia
   */
  async createBancolombiaQrTransaction({ orderId, amount, customerEmail = 'cliente@serviplus.pos' }) {
    const creds = this.getActiveCredentials();
    const aldeloAmount = parseFloat(amount) || 0;
    const amountInCOP = Math.round(aldeloAmount * 1000);
    const amountInCents = amountInCOP * 100;
    const reference = `SP-${orderId || Date.now()}-${Date.now().toString().slice(-4)}`;

    const signature = this.generateIntegritySignature(reference, amountInCents, creds.currency);
    const acceptanceToken = await this.getAcceptanceToken();

    const isSandbox = creds.mode === 'sandbox';

    const body = {
      acceptance_token: acceptanceToken,
      amount_in_cents: amountInCents,
      currency: creds.currency,
      signature: signature,
      customer_email: customerEmail,
      reference: reference,
      payment_method: {
        type: 'BANCOLOMBIA_QR',
        payment_description: `Pago Orden #${orderId || ''} en Kiosco`,
        ...(isSandbox && { sandbox_status: 'APPROVED' })
      }
    };

    const res = await this.request('POST', '/transactions', body, false);
    if (!res.ok) {
      const errorMsg = (res.data && res.data.error && res.data.error.reason) || 'Error creando transacción QR en Wompi';
      console.error('[Wompi Service] Create QR Error:', res.data);
      throw new Error(errorMsg);
    }

    const txData = res.data.data;
    const extra = txData?.payment_method?.extra || {};

    return {
      success: true,
      transactionId: txData.id,
      reference: txData.reference,
      status: txData.status,
      amountInCOP,
      amountInCents,
      qrImage: extra.qr_image || null, // Base64 del código QR oficial de Bancolombia
      qrId: extra.qr_id || null,
      externalIdentifier: extra.external_identifier || null,
      mode: creds.mode
    };
  }

  /**
   * Valida firma criptográfica de Webhook proveniente de Wompi
   */
  validateWebhookSignature(webhookBody) {
    const creds = this.getActiveCredentials();
    const eventsSecret = creds.eventsSecret;

    if (!eventsSecret) {
      console.warn('[Wompi Service] No eventsSecret configurado. Se omite validación de firma estricta.');
      return { ok: true, reason: 'No eventsSecret configured' };
    }

    try {
      const { signature = {}, timestamp, data: { transaction } = {} } = webhookBody || {};
      const { checksum, properties } = signature;

      if (!checksum || !Array.isArray(properties) || !properties.length) {
        return { ok: false, reason: 'Malformed signature' };
      }

      const values = properties.map((prop) => {
        const keys = prop.split('.');
        let value = { transaction };
        for (const key of keys) {
          value = value?.[key];
          if (value === undefined || value === null) return '';
        }
        return String(value);
      });

      const concatenated = values.join('') + timestamp + eventsSecret;
      const calculatedChecksum = crypto.createHash('sha256').update(concatenated).digest('hex');

      const checksumBuffer = Buffer.from(checksum, 'utf8');
      const calculatedBuffer = Buffer.from(calculatedChecksum, 'utf8');

      if (checksumBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(checksumBuffer, calculatedBuffer)) {
        console.error('[Wompi Service] Firma de Webhook inválida');
        return { ok: false, reason: 'Invalid signature' };
      }

      return { ok: true, reason: 'Firma válida' };
    } catch (err) {
      console.error('[Wompi Service] Error validando firma:', err);
      return { ok: false, reason: err.message };
    }
  }
}

module.exports = WompiService;
