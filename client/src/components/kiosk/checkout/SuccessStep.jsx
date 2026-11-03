import React from 'react';
import { sfx } from '../../../utils/audio';
import { KIOSK_CONFIG } from '../../../config/kioskConfig';
import { ThermalReceiptTicket } from './ThermalReceiptTicket';

export function SuccessStep({
  createdOrderNumber,
  createdOrderId,
  tableId,
  orderType,
  finalTotal,
  paymentMethod,
  createdReceiptCode,
  createdReceiptUrl,
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
  const qrFullUrl = `${window.location.origin}${createdReceiptUrl || `/p/p/${createdReceiptCode || 'SP-24'}`}`;

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
            <div className="checkout-status-badge">
              Pago procesado exitosamente
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
              <span>🍽️</span>
              <span>{orderType === 'EAT_IN' ? `Salón: Mesa #${tableId || 4}` : 'Para Llevar (Empacado)'}</span>
            </div>
            <div className="checkout-meta-tag kitchen">
              <span>👨‍🍳</span>
              <span>Enviado a Cocina ●</span>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Canales de Factura Digital */}
        <div className="checkout-receipt-channel-card">
          <div className="checkout-channel-header">
            <h3 className="checkout-channel-title">¿Cómo deseas llevarte tu factura?</h3>
            <span className="checkout-channel-badge">Recibo 100% Digital</span>
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
              <span className="tab-icon">💬</span>
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
              <span className="tab-icon">📱</span>
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
              <span className="tab-icon">📷</span>
              <span>Ver QR</span>
            </button>
          </div>

          {/* Contenido del Canal Seleccionado */}
          <div className="checkout-channel-tab-content">
            {/* CANAL: CÓDIGO QR EN PANTALLA */}
            {activeReceiptTab === 'qr' && (
              <div className="checkout-qr-view-box">
                <div className="checkout-qr-inner-card">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrFullUrl)}`}
                    alt="QR Factura Digital"
                    className="checkout-receipt-qr-img"
                  />
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
                      disabled={receiptInput.length < KIOSK_CONFIG.validation.phoneMinLength}
                      onClick={onSendWhatsApp}
                      className="checkout-btn-send-whatsapp"
                    >
                      <span>💬</span>
                      <span>Abrir en WhatsApp</span>
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
      </div>
    </div>
  );
}
