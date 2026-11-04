import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { formatCOP } from '../../../utils/format';

export function PaymentStep({
  orderType,
  tableId,
  total,
  paymentMethod,
  onSelectPaymentMethod,
  wompiQrData,
  qrLoading,
  qrError,
  isSubmitting,
  onConfirmOrder
}) {
  const [localFallbackQr, setLocalFallbackQr] = useState('');

  useEffect(() => {
    if (wompiQrData?.checkoutUrl && !wompiQrData?.qrImage) {
      QRCode.toDataURL(wompiQrData.checkoutUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      })
        .then((url) => setLocalFallbackQr(url))
        .catch((err) => console.warn('[PaymentStep] Error generating local QR:', err));
    }
  }, [wompiQrData?.checkoutUrl, wompiQrData?.qrImage]);

  const methods = [
    { id: 'WOMPI_QR', icon: '📱', label: 'QR Bancolombia / Wompi', badge: 'Pago Automático' },
    { id: 'CASH', icon: '💵', label: 'Efectivo en Caja', badge: 'Front Desk' },
    { id: 'CARD', icon: '💳', label: 'Datáfono en Caja', badge: 'Front Desk' }
  ];

  return (
    <div className="checkout-step-page-scroll animate-step-fade">
      {/* Resumen de Modalidad y Total */}
      <div className="checkout-payment-summary-box">
        <div>
          <div className="checkout-footer-total-lbl">DESTINO DE TU ORDEN</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
            {orderType === 'EAT_IN' ? `🍽️ Comer en Mesa #${tableId}` : '🛍️ Empacado Para Llevar'}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="checkout-footer-total-lbl">TOTAL A PAGAR</div>
          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#047857', letterSpacing: '-0.5px' }}>
            {formatCOP(total)}
          </div>
        </div>
      </div>

      {/* Selector de Medios de Pago */}
      <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 14px 0' }}>
        Selecciona tu medio de pago:
      </h3>

      <div className="checkout-payment-methods-grid">
        {methods.map((m) => {
          const isSelected = paymentMethod === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectPaymentMethod(m.id)}
              className={`checkout-payment-card ${isSelected ? 'selected' : ''}`}
            >
              <div style={{ fontSize: '2.4rem', marginBottom: '4px' }}>{m.icon}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>{m.label}</div>
              <span className="checkout-payment-card-badge">{m.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Detalle Interactivo de la opción seleccionada */}
      <div className="checkout-payment-detail-center">
        {paymentMethod === 'WOMPI_QR' && (
          <div className="checkout-qr-box">
            {qrLoading ? (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '8px' }}>🔄</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>Generando QR Bancolombia / Nequi...</div>
                <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0 0' }}>Conectando con la pasarela de pagos Wompi</p>
              </div>
            ) : qrError ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#b91c1c' }}>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>⚠️</div>
                <div style={{ fontWeight: 800 }}>{qrError}</div>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Puedes elegir otro medio de pago para continuar.</p>
              </div>
            ) : wompiQrData?.qrImage ? (
              <div>
                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '20px', display: 'inline-block', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)', border: '1px solid #e2e8f0' }}>
                  <img
                    src={
                      wompiQrData.qrImage.startsWith('data:')
                        ? wompiQrData.qrImage
                        : wompiQrData.qrImage.startsWith('PD94bWw') || wompiQrData.qrImage.startsWith('PHN2Zw')
                          ? `data:image/svg+xml;base64,${wompiQrData.qrImage}`
                          : `data:image/png;base64,${wompiQrData.qrImage}`
                    }
                    alt="Código QR Bancolombia / Nequi"
                    style={{ width: '210px', height: '210px', display: 'block', margin: '0 auto', borderRadius: '10px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '14px' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                    Escanea con tu App Bancolombia o Nequi
                  </span>
                  <span style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.78rem', fontWeight: 900, padding: '3px 10px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
                    ● Listo
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '6px 0 0 0' }}>
                  Total: <strong style={{ color: '#047857' }}>{formatCOP(total)}</strong> • Ref: <strong>{wompiQrData.reference}</strong>
                </p>
                <div style={{ marginTop: '10px', fontSize: '0.84rem', color: '#059669', fontWeight: 700, background: '#f0fdf4', padding: '8px 16px', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'inline-block' }}>
                  ⚡ Al completar el pago en tu celular, el Kiosco lo detecta y envía la orden a cocina al instante.
                </div>
              </div>
            ) : localFallbackQr ? (
              <div>
                <div style={{ background: '#ffffff', padding: '12px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)', border: '1px solid #e2e8f0' }}>
                  <img
                    src={localFallbackQr}
                    alt="Código QR de Pago"
                    style={{ width: '180px', height: '180px', margin: '0 auto', display: 'block', borderRadius: '10px' }}
                  />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '12px' }}>
                  Escanea con tu App Bancolombia, Nequi o Cámara
                </div>
                <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  Tu pago se confirma de inmediato y tu orden pasa directamente a la pantalla de cocina.
                </p>
              </div>
            ) : (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '8px' }}>🔄</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>Generando QR local...</div>
              </div>
            )}
          </div>
        )}

        {paymentMethod === 'CASH' && (
          <div className="checkout-cash-box">
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>💵</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#065f46' }}>
              Pago en Efectivo en Caja
            </div>
            <p style={{ fontSize: '0.96rem', color: '#047857', fontWeight: 600, margin: '10px 0 0 0', lineHeight: 1.5 }}>
              Al presionar <strong>Confirmar Orden</strong>, tu turno quedará reservado. Acércate a la <strong>Caja / Front Desk</strong> para pagar. La cocina comenzará tu comida tan pronto reciban el pago.
            </p>
          </div>
        )}

        {paymentMethod === 'CARD' && (
          <div className="checkout-card-box">
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>💳</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1e40af' }}>
              Pago con Tarjeta o Datáfono en Caja
            </div>
            <p style={{ fontSize: '0.96rem', color: '#1d4ed8', fontWeight: 600, margin: '10px 0 0 0', lineHeight: 1.5 }}>
              Acércate con tu número de orden a la <strong>Caja / Front Desk</strong> para pasar tu tarjeta débito o crédito por el datáfono.
            </p>
          </div>
        )}
      </div>

      {/* Botón de Confirmación Final */}
      <div style={{ marginTop: '24px' }}>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onConfirmOrder}
          className="checkout-confirm-btn pulse-emerald-btn"
        >
          {isSubmitting ? (
            'Enviando orden a cocina...'
          ) : paymentMethod === 'WOMPI_QR' ? (
            '✓ Confirmar y Enviar a Cocina'
          ) : (
            '✓ Confirmar Orden y Pagar en Caja'
          )}
        </button>
      </div>
    </div>
  );
}

