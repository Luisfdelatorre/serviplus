import React, { useState } from 'react';
import { formatCOP } from '../../../utils/format';
import { KIOSK_CONFIG } from '../../../config/kioskConfig';

export function ThermalReceiptTicket({
  orderNumber,
  tableId,
  orderType,
  items = [],
  total = 0,
  paymentMethod = 'WOMPI_QR',
  reference = '',
  dateStr,
  timeStr
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const now = new Date();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const displayDate = dateStr || `${String(now.getDate()).padStart(2, '0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
  const displayTime = timeStr || now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

  const displayItems = (items && items.length > 0) ? items : [
    { id: 101, name: 'Kebab Mixto Especial', price: 18.0, quantity: 2, modifiers: [{ id: 1, name: 'Queso Extra', price: 2.0 }] },
    { id: 102, name: 'Papas Rústicas', price: 8.0, quantity: 1 }
  ];

  const subtotal = Math.round(total / 1.19);
  const tax = total - subtotal;

  const paymentLabel = paymentMethod === 'WOMPI_QR'
    ? 'Wompi QR (APROBADO)'
    : paymentMethod === 'CASH'
      ? 'Efectivo en Caja'
      : 'Tarjeta / Datáfono';

  return (
    <div className="receipt-paper-ticket">
      {/* Banner / Logotipo Panorámico Kebab & Shawarma */}
      {!logoFailed && (
        <div className="receipt-ticket-logo-banner">
          <img
            src={KIOSK_CONFIG.restaurant.logoUrl || '/images/kebab_brand_banner.png'}
            alt="Kebab & Shawarma"
            className="receipt-ticket-banner-img"
            onError={() => setLogoFailed(true)}
          />
        </div>
      )}

      {/* Encabezado del Comercio */}
      <div className="receipt-ticket-header">
        {logoFailed && (
          <h3 className="receipt-store-name">{KIOSK_CONFIG.restaurant.logoEmoji} {KIOSK_CONFIG.restaurant.name}</h3>
        )}
        <p className="receipt-fiscal-sub">NIT: {KIOSK_CONFIG.restaurant.nit}</p>
        <p className="receipt-fiscal-sub">{KIOSK_CONFIG.restaurant.address}</p>
      </div>

      <div className="receipt-dashed-separator" />

      {/* Orden y Mesa */}
      <div className="receipt-info-two-col">
        <span><strong>ORDEN:</strong> #{orderNumber || 24}</span>
        <span><strong>MESA:</strong> {orderType === 'EAT_IN' ? (tableId || 4) : 'LLEVAR'}</span>
      </div>
      <div className="receipt-info-two-col">
        <span>{displayDate}</span>
        <span>{displayTime}</span>
      </div>

      <div className="receipt-dashed-separator" />

      {/* Lista de Platos Comprados */}
      <div className="receipt-ticket-items-list">
        {displayItems.map((item, idx) => (
          <div key={idx} className="receipt-ticket-item-entry">
            <div className="receipt-item-line">
              <span className="receipt-item-qty-name">{item.quantity}x {item.name}</span>
              <span className="receipt-item-price">{formatCOP((item.price || item.unitPrice || 0) * (item.quantity || 1))}</span>
            </div>
            {item.modifiers && item.modifiers.length > 0 && (
              <div className="receipt-item-mods-indent">
                {item.modifiers.map((m, mIdx) => (
                  <div key={mIdx} className="receipt-mod-subline">
                    + {m.name || m.N}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="receipt-dashed-separator" />

      {/* Desglose de Totales */}
      <div className="receipt-totals-block">
        <div className="receipt-totals-row">
          <span>SUBTOTAL:</span>
          <span>{formatCOP(subtotal > 0 ? subtotal : total)}</span>
        </div>
        <div className="receipt-totals-row receipt-bold-total">
          <span>TOTAL PAGADO:</span>
          <span className="receipt-total-green">{formatCOP(total)}</span>
        </div>
      </div>

      <div className="receipt-dashed-separator" />

      {/* Metadatos de Pago y Referencia */}
      <div className="receipt-meta-block">
        <div className="receipt-meta-row">
          <span>PAGO:</span>
          <span className="receipt-meta-val">{paymentLabel}</span>
        </div>
        <div className="receipt-meta-row">
          <span>REF:</span>
          <span className="receipt-meta-val receipt-mono">{reference || 'SP-1793691288288'}</span>
        </div>
      </div>

      {/* Código de Barras Decorativo */}
      <div className="receipt-barcode-wrap">
        <div className="receipt-barcode-pattern" />
      </div>

      {/* Pie de Recibo */}
      <div className="receipt-ticket-footer">
        <p className="receipt-thank-you">¡Gracias por tu compra!</p>
        <p className="receipt-claim-msg">{KIOSK_CONFIG.restaurant.receiptFooter}</p>
      </div>

      {/* Borde Perforado Inferior */}
      <div className="receipt-perforated-edge">
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} className="perforated-hole" />
        ))}
      </div>
    </div>
  );
}
