import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Banknote, CreditCard } from 'lucide-react';
import { formatCOP } from '../../../utils/format';

function StylizedBancolombiaQrSvg() {
  return (
    <svg className="kpay-qr-svg" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      {/* 3 Corner Finder Markers */}
      <rect x="4" y="4" width="26" height="26" rx="4" fill="black" />
      <rect x="8" y="8" width="18" height="18" rx="2" fill="white" />
      <rect x="12" y="12" width="10" height="10" rx="1" fill="black" />

      <rect x="70" y="4" width="26" height="26" rx="4" fill="black" />
      <rect x="74" y="8" width="18" height="18" rx="2" fill="white" />
      <rect x="78" y="12" width="10" height="10" rx="1" fill="black" />

      <rect x="4" y="70" width="26" height="26" rx="4" fill="black" />
      <rect x="8" y="74" width="18" height="18" rx="2" fill="white" />
      <rect x="12" y="78" width="10" height="10" rx="1" fill="black" />

      {/* QR Data Matrix Pattern */}
      <rect x="34" y="6" width="5" height="5" />
      <rect x="43" y="6" width="9" height="5" />
      <rect x="56" y="6" width="6" height="5" />
      <rect x="34" y="15" width="8" height="5" />
      <rect x="46" y="15" width="5" height="9" />
      <rect x="55" y="15" width="8" height="5" />
      <rect x="34" y="24" width="5" height="6" />
      <rect x="43" y="24" width="9" height="6" />
      <rect x="56" y="24" width="6" height="6" />

      <rect x="6" y="34" width="5" height="5" />
      <rect x="15" y="34" width="9" height="5" />
      <rect x="28" y="34" width="6" height="5" />
      <rect x="38" y="34" width="8" height="8" />
      <rect x="50" y="34" width="12" height="5" />
      <rect x="66" y="34" width="8" height="5" />
      <rect x="78" y="34" width="5" height="8" />
      <rect x="87" y="34" width="7" height="5" />

      <rect x="6" y="43" width="9" height="6" />
      <rect x="19" y="43" width="6" height="8" />
      <rect x="29" y="43" width="5" height="6" />
      <rect x="66" y="43" width="12" height="6" />
      <rect x="82" y="43" width="12" height="6" />

      <rect x="6" y="53" width="5" height="10" />
      <rect x="15" y="53" width="8" height="6" />
      <rect x="27" y="53" width="7" height="6" />
      <rect x="38" y="46" width="6" height="13" />
      <rect x="48" y="46" width="14" height="6" />
      <rect x="66" y="53" width="7" height="10" />
      <rect x="77" y="53" width="7" height="6" />
      <rect x="88" y="53" width="6" height="10" />

      <rect x="34" y="63" width="8" height="6" />
      <rect x="46" y="63" width="6" height="6" />
      <rect x="56" y="63" width="10" height="6" />
      <rect x="70" y="63" width="12" height="6" />
      <rect x="86" y="63" width="8" height="6" />

      <rect x="34" y="73" width="6" height="11" />
      <rect x="44" y="73" width="11" height="6" />
      <rect x="59" y="73" width="6" height="11" />
      <rect x="69" y="73" width="11" height="6" />
      <rect x="84" y="73" width="10" height="11" />

      <rect x="34" y="88" width="14" height="6" />
      <rect x="52" y="88" width="8" height="6" />
      <rect x="64" y="88" width="14" height="6" />
      <rect x="82" y="88" width="12" height="6" />
    </svg>
  );
}

export function PaymentStep({
  orderType,
  tableId,
  total,
  paymentMethod,
  enabledMethods,
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
        width: 280,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      })
        .then((url) => setLocalFallbackQr(url))
        .catch((err) => console.warn('[PaymentStep] Error generating local QR:', err));
    }
  }, [wompiQrData?.checkoutUrl, wompiQrData?.qrImage]);

  const allMethods = [
    {
      id: 'WOMPI_QR',
      Icon: QrCode,
      iconTone: 'purple',
      label: 'QR Bancolombia / Wompi',
      badge: 'Pago Automático',
      badgeTone: 'amber'
    },
    {
      id: 'CASH',
      Icon: Banknote,
      iconTone: 'emerald',
      label: 'Efectivo en Caja',
      badge: 'Front Desk',
      badgeTone: 'neutral'
    },
    {
      id: 'CARD',
      Icon: CreditCard,
      iconTone: 'blue',
      label: 'Datáfono en Caja',
      badge: 'Front Desk',
      badgeTone: 'neutral'
    }
  ];
  // Solo los métodos que el administrador dejó habilitados.
  const methods = allMethods.filter((m) => enabledMethods.includes(m.id));

  const resolvedQrImgSrc = wompiQrData?.qrImage
    ? wompiQrData.qrImage.startsWith('data:')
      ? wompiQrData.qrImage
      : wompiQrData.qrImage.startsWith('PD94bWw') || wompiQrData.qrImage.startsWith('PHN2Zw')
        ? `data:image/svg+xml;base64,${wompiQrData.qrImage}`
        : `data:image/png;base64,${wompiQrData.qrImage}`
    : localFallbackQr || null;

  const displayRef = wompiQrData?.reference || 'SP-821-9329';

  return (
    <div className="kpay-page-shell animate-step-fade">
      {/* MAIN VIEWPORT CONTENT (Compact vertical spacing & maximized QR container) */}
      <main className="kpay-main-container">
        {/* DESTINATION & TOTAL BANNER (Compact height) */}
        <div className="kpay-dest-banner">
          <div className="kpay-dest-left">
            <span className="kpay-dest-emoji">{orderType === 'EAT_IN' ? '🍽️' : '🛍️'}</span>
            <div>
              <span className="kpay-dest-overline">DESTINO DE TU ORDEN</span>
              <span className="kpay-dest-value">
                {orderType === 'EAT_IN'
                  ? `Comer en Mesa #${tableId || 1}`
                  : 'Empacado Para Llevar'}
              </span>
            </div>
          </div>

          <div className="kpay-dest-right">
            <span className="kpay-dest-overline">TOTAL A PAGAR</span>
            <span className="kpay-dest-total">{formatCOP(total)}</span>
          </div>
        </div>

        {/* 3 PAYMENT TILES (COMPACT VERTICAL PROFILE) */}
        <div className="kpay-tiles-grid">
          {methods.map((m) => {
            const isSelected = paymentMethod === m.id;
            const TileIcon = m.Icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectPaymentMethod(m.id)}
                className={`kpay-method-tile ${isSelected ? 'is-selected' : ''}`}
              >
                <div className={`kpay-tile-icon-box tone-${m.iconTone}`}>
                  <TileIcon size={22} />
                </div>
                <div className="kpay-tile-body">
                  <h3 className="kpay-tile-title">{m.label}</h3>
                  <span
                    className={`ui-pill ui-pill-xs ${m.badgeTone === 'amber' ? 'ui-pill-amber' : 'ui-pill-neutral'}`}
                  >
                    {m.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* MAIN DISPLAY CARD (Expansive Display Frame with Large QR Code) */}
        {paymentMethod === 'WOMPI_QR' && (
          <div className="kpay-display-card">
            {/* Stylized High-Definition Bancolombia / Wompi QR Code Card (Enlarged) */}
            <div className="kpay-qr-outer-card">
              <div className="kpay-qr-canvas">
                {resolvedQrImgSrc ? (
                  <img
                    src={resolvedQrImgSrc}
                    alt="Código QR Bancolombia / Nequi"
                    className="kpay-qr-img"
                  />
                ) : (
                  <StylizedBancolombiaQrSvg />
                )}

                {/* Authentic Center Bancolombia Logo Stamp */}
                <div className="kpay-bancolombia-stamp">
                  <div className="kpay-stamp-bar bar-black" />
                  <div className="kpay-stamp-bar bar-amber" />
                  <div className="kpay-stamp-bar bar-rose" />
                </div>
              </div>
            </div>

            {/* Instruction Headline & Status Tag */}
            <div className="kpay-qr-info-block">
              <div className="kpay-qr-headline-row">
                <h3 className="kpay-qr-headline">Escanea con tu App Bancolombia o Nequi</h3>
                <span className="ui-pill ui-pill-xs ui-pill-emerald">
                  <span className="ui-dot online" />
                  <span>{qrLoading ? 'Sincronizando' : 'Listo'}</span>
                </span>
              </div>
              <p className="kpay-qr-meta-line">
                Total: <span className="kpay-meta-total">{formatCOP(total)}</span> • Ref:{' '}
                <span className="kpay-meta-ref">{displayRef}</span>
              </p>
              {qrError && <p className="kpay-qr-error-note">{qrError}</p>}
            </div>

            {/* Botón opcional de confirmación inmediata */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onConfirmOrder}
              className="kpay-confirm-action-btn"
            >
              {isSubmitting ? 'Enviando orden ...' : '✓ Confirmar el pago'}
            </button>
          </div>
        )}

        {paymentMethod === 'CASH' && (
          <div className="kpay-display-card kpay-frontdesk-card">
            <div className="kpay-frontdesk-icon-circle tone-emerald">
              <Banknote size={38} />
            </div>
            <h3 className="kpay-qr-headline">Pago en Efectivo en Caja (Front Desk)</h3>
            <p className="kpay-frontdesk-desc">
              Al presionar <strong>Confirmar Orden</strong>, tu turno quedará reservado. Acércate a
              la <strong>Caja Principal</strong> para realizar tu pago en efectivo y tu pedido
              entrará de inmediato a preparación.
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onConfirmOrder}
              className="kpay-confirm-action-btn is-primary"
            >
              {isSubmitting ? 'Enviando orden...' : '✓ Confirmar Orden y Pagar en Caja'}
            </button>
          </div>
        )}

        {paymentMethod === 'CARD' && (
          <div className="kpay-display-card kpay-frontdesk-card">
            <div className="kpay-frontdesk-icon-circle tone-blue">
              <CreditCard size={38} />
            </div>
            <h3 className="kpay-qr-headline">Pago con Datáfono en Caja (Front Desk)</h3>
            <p className="kpay-frontdesk-desc">
              Acércate con tu número de turno a la <strong>Caja Principal</strong> para pasar tu
              tarjeta débito, crédito o contactless por el datáfono.
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onConfirmOrder}
              className="kpay-confirm-action-btn is-primary"
            >
              {isSubmitting ? 'Enviando orden...' : '✓ Confirmar Orden y Pagar en Caja'}
            </button>
          </div>
        )}
      </main>

      {/* BOTTOM FOOTER */}
      <footer className="kpay-bottom-footer">
        <div className="kpay-footer-inner">
          <div className="kpay-footer-left">
            <span className="kpay-footer-brand">UPAYSOLUTIONS KIOSCO</span>
            <span>•</span>
            <span>Pasarela de Pago Segura</span>
          </div>
          <div className="kpay-footer-right">
            <span className="ui-dot online lg ui-dot-pulse" />
            <span>Escucha bancaria en vivo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
