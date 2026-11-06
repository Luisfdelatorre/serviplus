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
          <div className="pay-s-1">
            {orderType === 'EAT_IN' ? `🍽️ Comer en Mesa #${tableId}` : '🛍️ Empacado Para Llevar'}
          </div>
        </div>

        <div className="pay-s-2">
          <div className="checkout-footer-total-lbl">TOTAL A PAGAR</div>
          <div className="pay-s-3">
            {formatCOP(total)}
          </div>
        </div>
      </div>

      {/* Selector de Medios de Pago */}
      <h3 className="pay-s-4">
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
              <div className="pay-s-5">{m.icon}</div>
              <div className="pay-s-6">{m.label}</div>
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
              <div className="pay-s-7">
                <div className="pay-s-8">🔄</div>
                <div className="pay-s-9">Generando QR Bancolombia / Nequi...</div>
                <p className="pay-s-10">Conectando con la pasarela de pagos Wompi</p>
              </div>
            ) : qrError ? (
              <div className="pay-s-11">
                <div className="pay-s-12">⚠️</div>
                <div className="pay-s-13">{qrError}</div>
                <p className="pay-s-14">Puedes elegir otro medio de pago para continuar.</p>
              </div>
            ) : wompiQrData?.qrImage ? (
              <div>
                <div className="pay-s-15">
                  <img
                    src={
                      wompiQrData.qrImage.startsWith('data:')
                        ? wompiQrData.qrImage
                        : wompiQrData.qrImage.startsWith('PD94bWw') || wompiQrData.qrImage.startsWith('PHN2Zw')
                          ? `data:image/svg+xml;base64,${wompiQrData.qrImage}`
                          : `data:image/png;base64,${wompiQrData.qrImage}`
                    }
                    alt="Código QR Bancolombia / Nequi"
                    className="pay-s-16"
                  />
                </div>
                <div className="pay-s-17">
                  <span className="pay-s-18">
                    Escanea con tu App Bancolombia o Nequi
                  </span>
                  <span className="pay-s-19">
                    ● Listo
                  </span>
                </div>
                <p className="pay-s-20">
                  Total: <strong className="pay-s-21">{formatCOP(total)}</strong> • Ref: <strong>{wompiQrData.reference}</strong>
                </p>
                <div className="pay-s-22">
                  ⚡ Al completar el pago en tu celular, el Kiosco lo detecta y envía la orden a cocina al instante.
                </div>
              </div>
            ) : localFallbackQr ? (
              <div>
                <div className="pay-s-23">
                  <img
                    src={localFallbackQr}
                    alt="Código QR de Pago"
                    className="pay-s-24"
                  />
                </div>
                <div className="pay-s-25">
                  Escanea con tu App Bancolombia, Nequi o Cámara
                </div>
                <p className="pay-s-10">
                  Tu pago se confirma de inmediato y tu orden pasa directamente a la pantalla de cocina.
                </p>
              </div>
            ) : (
              <div className="pay-s-7">
                <div className="pay-s-8">🔄</div>
                <div className="pay-s-9">Generando QR local...</div>
              </div>
            )}
          </div>
        )}

        {paymentMethod === 'CASH' && (
          <div className="checkout-cash-box">
            <div className="pay-s-26">💵</div>
            <div className="pay-s-27">
              Pago en Efectivo en Caja
            </div>
            <p className="pay-s-28">
              Al presionar <strong>Confirmar Orden</strong>, tu turno quedará reservado. Acércate a la <strong>Caja / Front Desk</strong> para pagar. La cocina comenzará tu comida tan pronto reciban el pago.
            </p>
          </div>
        )}

        {paymentMethod === 'CARD' && (
          <div className="checkout-card-box">
            <div className="pay-s-26">💳</div>
            <div className="pay-s-29">
              Pago con Tarjeta o Datáfono en Caja
            </div>
            <p className="pay-s-30">
              Acércate con tu número de orden a la <strong>Caja / Front Desk</strong> para pasar tu tarjeta débito o crédito por el datáfono.
            </p>
          </div>
        )}
      </div>

      {/* Botón de Confirmación Final */}
      <div className="pay-s-31">
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

