import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { sfx } from '../../../utils/audio';
import { KIOSK_CONFIG } from '../../../config/kioskConfig';
import { ThermalReceiptTicket } from './ThermalReceiptTicket';
import { printOrderTicket } from '../../../api';

export function SuccessStep({
  createdOrderNumber,
  createdOrderId,
  tableId,
  orderType,
  finalTotal,
  paymentMethod,
  createdReceiptCode,
  createdReceiptUrl,
  createdReceiptFullUrl,
  completedOrderItems = [],
  activeReceiptTab,
  setActiveReceiptTab,
  receiptInput,
  setReceiptInput,
  receiptSentSuccess,
  receiptDestination,
  isSendingReceipt,
  secondsRemaining,
  onSendWhatsApp,
  onSendSMS,
  onFinish
}) {
  const [localQrDataUrl, setLocalQrDataUrl] = useState('');
  const [thermalPrintStatus, setThermalPrintStatus] = useState('idle'); // 'idle' | 'printing' | 'success' | 'error'
  const [thermalPrintError, setThermalPrintError] = useState('');
  const qrFullUrl = createdReceiptFullUrl || `https://serviplus.upaysolutions.app${createdReceiptUrl || `/p/${createdReceiptCode || 'SP-24'}`}`;

  const handlePrintThermalTicket = async () => {
    sfx.playTap();
    setThermalPrintStatus('printing');
    setThermalPrintError('');
    try {
      await printOrderTicket({
        orderId: createdOrderId,
        orderNumber: createdOrderNumber,
        orderType,
        tableId,
        items: completedOrderItems,
        total: finalTotal,
        paymentMethod,
        receiptCode: createdReceiptCode,
        receiptFullUrl: qrFullUrl
      });
      setThermalPrintStatus('success');
      sfx.playSuccess();
      setTimeout(() => setThermalPrintStatus('idle'), 6000);
    } catch (err) {
      console.error('[SuccessStep] Error printing thermal ticket:', err);
      setThermalPrintStatus('error');
      setThermalPrintError(err.message || 'Error al conectar con la impresora');
      setTimeout(() => setThermalPrintStatus('idle'), 5000);
    }
  };

  useEffect(() => {
    QRCode.toDataURL(qrFullUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setLocalQrDataUrl(url))
      .catch((err) => {
        console.warn('[SuccessStep] Error generating local QR:', err);
      });
  }, [qrFullUrl]);

  return (
    <div className="checkout-success-split-layout animate-step-fade">
      {/* ================= COLUMNA IZQUIERDA: ESTADO Y RECIBO DIGITAL ================= */}
      <div className="checkout-success-left-col">
        {/* Tarjeta 1: Estado del Pedido y Turno */}
        <div className="checkout-status-card">
          <div className="checkout-status-top-bar">
            <div className="checkout-success-pill">
              <span className="success-check-icon">✓</span>
              <span className="success-check-text">¡Pago Exitoso!</span>
            </div>

          </div>

          <div className="checkout-turn-display-wrap">
            <div className="checkout-turn-label">TU NÚMERO DE TURNO</div>
            <div className="checkout-turn-number">
              <span className="turn-hash">#</span>{createdOrderNumber || 24}
            </div>
          </div>

          <div className="checkout-status-meta-row">
            <div className="checkout-meta-tag salon">
              <span>{orderType === 'EAT_IN' ? `Salón: Mesa #${tableId || 4}` : 'Para Llevar (Empacado)'}</span>
            </div>

          </div>
        </div>

        {/* Tarjeta 2: Canales de Factura Digital */}
        <div className="checkout-receipt-channel-card">
          <div className="checkout-channel-header">
            <h3 className="checkout-channel-title">¿Cómo deseas llevarte tu factura?</h3>
          </div>

          {/* Selector de Pestañas de Canales */}
          <div className="checkout-channel-tabs-bar">
            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setActiveReceiptTab('whatsapp');
              }}
              className={`checkout-channel-tab ${activeReceiptTab === 'whatsapp' ? 'active' : ''}`}
            >

              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setActiveReceiptTab('sms');
              }}
              className={`checkout-channel-tab ${activeReceiptTab === 'sms' ? 'active' : ''}`}
            >

              <span>Texto / SMS</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setActiveReceiptTab('qr');
              }}
              className={`checkout-channel-tab ${activeReceiptTab === 'qr' ? 'active' : ''}`}
            >
              <span>Ver QR</span>
            </button>
          </div>

          {/* Contenido del Canal Seleccionado */}
          <div className="checkout-channel-tab-content">
            {/* CANAL: CÓDIGO QR EN PANTALLA */}
            {activeReceiptTab === 'qr' && (
              <div className="checkout-qr-view-box">
                <div className="checkout-qr-inner-card">
                  {localQrDataUrl ? (
                    <img
                      src={localQrDataUrl}
                      alt="Código QR Factura Digital"
                      className="checkout-receipt-qr-img"
                    />
                  ) : (
                    <div style={{ width: '160px', height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b' }}>
                      <span style={{ fontSize: '1.8rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Generando QR local...</span>
                    </div>
                  )}
                </div>
                <div className="checkout-qr-inst-title">Apunta tu cámara aquí</div>
                <div className="checkout-qr-inst-sub">
                  Se abrirá la factura digital inmediatamente en tu teléfono.
                </div>
              </div>
            )}

            {/* CANAL: WHATSAPP O SMS CON TECLADO NUMÉRICO TÁCTIL */}
            {(activeReceiptTab === 'whatsapp' || activeReceiptTab === 'sms') && !receiptSentSuccess && (
              <div className="checkout-phone-tab-box">
                <div className="checkout-phone-screen-display">
                  <span className="phone-prefix">{KIOSK_CONFIG.validation.phonePrefix}</span>
                  <span className={`phone-number-text ${!receiptInput ? 'empty' : ''}`}>
                    {receiptInput || 'Ingresa tu número de celular'}
                  </span>
                </div>

                {/* Teclado Numérico Táctil */}
                <div className="checkout-compact-numpad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        if (k === 'C') setReceiptInput('');
                        else if (k === '⌫') setReceiptInput((p) => p.slice(0, -1));
                        else if (receiptInput.length < KIOSK_CONFIG.validation.phoneMaxLength) setReceiptInput((p) => p + k);
                      }}
                      className={`checkout-compact-key ${k === 'C' ? 'clear' : k === '⌫' ? 'del' : ''}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                <div className="checkout-phone-action-row">
                  {activeReceiptTab === 'whatsapp' ? (
                    <button
                      type="button"
                      disabled={receiptInput.length < KIOSK_CONFIG.validation.phoneMinLength || isSendingReceipt}
                      onClick={onSendWhatsApp}
                      className="checkout-btn-send-whatsapp"
                    >
                      <span>💬</span>
                      <span>{isSendingReceipt ? 'Enviando...' : 'Enviar por WhatsApp'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={receiptInput.length < KIOSK_CONFIG.validation.phoneMinLength || isSendingReceipt}
                      onClick={onSendSMS}
                      className="checkout-btn-send-sms"
                    >
                      <span>📱</span>
                      <span>{isSendingReceipt ? 'Enviando...' : 'Enviar por SMS'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CONFIRMACIÓN DE ENVÍO */}
            {receiptSentSuccess && (
              <div className="checkout-sent-success-feedback">
                <div className="checkout-feedback-icon">✓</div>
                <div className="checkout-feedback-title">¡Comprobante enviado!</div>
                <p className="checkout-feedback-desc">
                  Enviado exitosamente a <strong>{KIOSK_CONFIG.validation.phonePrefix} {receiptDestination}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Botón Inferior: Sin Recibo / Finalizar */}
          <button type="button" onClick={onFinish} className="checkout-bottom-finish-btn">
            <span>✕</span>
            <span>Sin Recibo / Finalizar ({secondsRemaining}s)</span>
          </button>
        </div>
      </div>

      {/* ================= COLUMNA DERECHA: RECIBO TÉRMICO ================= */}
      <div className="checkout-success-right-col">
        <ThermalReceiptTicket
          orderNumber={createdOrderNumber}
          tableId={tableId}
          orderType={orderType}
          items={completedOrderItems}
          total={finalTotal}
          paymentMethod={paymentMethod}
          reference={createdReceiptCode || 'SP-1793691288288'}
        />

        {/* Botón de Impresión en Impresora Térmica Física */}
        <div style={{ marginTop: '14px', width: '100%', maxWidth: '340px' }}>
          <button
            type="button"
            onClick={handlePrintThermalTicket}
            disabled={thermalPrintStatus === 'printing'}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: '16px',
              border: thermalPrintStatus === 'success' ? '2px solid #10b981' : '2px solid #0f172a',
              background: thermalPrintStatus === 'success'
                ? '#ecfdf5'
                : thermalPrintStatus === 'error'
                  ? '#fef2f2'
                  : '#0f172a',
              color: thermalPrintStatus === 'success'
                ? '#065f46'
                : thermalPrintStatus === 'error'
                  ? '#b91c1c'
                  : '#ffffff',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: thermalPrintStatus === 'printing' ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {thermalPrintStatus === 'printing' ? (
              <>
                <span style={{ fontSize: '1.2rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</span>
                <span>Imprimiendo en POS-58...</span>
              </>
            ) : thermalPrintStatus === 'success' ? (
              <>
                <span style={{ fontSize: '1.2rem' }}>✓</span>
                <span>¡Ticket Impreso con Éxito!</span>
              </>
            ) : thermalPrintStatus === 'error' ? (
              <>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <span>Reintentar Impresión ({thermalPrintError ? 'Error' : 'Reintentar'})</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.25rem' }}>🖨️</span>
                <span>Imprimir Ticket Térmico</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
