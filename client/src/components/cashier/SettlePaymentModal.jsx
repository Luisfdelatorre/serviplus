import React from 'react';
import {
  BadgeDollarSign,
  X,
  Utensils,
  ShoppingBag,
  CheckCircle2
} from 'lucide-react';
import { formatCOP } from '../../utils/format';
import { sfx } from '../../utils/audio';
import { PaymentMethodTabs } from './PaymentMethodTabs';

export function SettlePaymentModal({
  settlingOrder,
  settlePayMethod,
  setSettlePayMethod,
  enabledPaymentMethods,
  settleCashTendered,
  setSettleCashTendered,
  isSubmitting,
  onClose,
  onConfirm
}) {
  if (!settlingOrder) return null;

  const isModalTakeOut = Number(settlingOrder.orderType) === 2 || !settlingOrder.tableId;
  const totalCOP = Math.round(settlingOrder.total * 1000);
  const tenderedVal = parseFloat(String(settleCashTendered).replace(/\D/g, '')) || 0;
  const isEnoughCash = tenderedVal >= totalCOP;
  const changeCOP = Math.max(0, tenderedVal - totalCOP);

  return (
    <div className="cpos-spm-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spm-modal-title"
        className="cpos-spm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Icon + Title + Close Button) */}
        <div className="cpos-spm-header">
          <div className="cpos-spm-header-left">
            <div className="ui-icon-box ui-icon-box-md">
              <BadgeDollarSign className="ui-icon-24" />
            </div>
            <div>
              <h2 id="spm-modal-title" className="ui-heading-md cpos-spm-title">
                Completar Pago de Orden
              </h2>
              <p className="ui-label-sm ui-text-muted cpos-spm-subtitle">
                Turno #{settlingOrder.orderNumber || settlingOrder.id} • Comanda activa
              </p>
            </div>
          </div>

          {/* iOS Close Pill */}
          <button
            type="button"
            title="Cerrar modal"
            onClick={() => {
              sfx.playTap();
              onClose();
            }}
            className="ui-btn-icon-circle cpos-spm-close-btn"
          >
            <X className="ui-icon-16" />
          </button>
        </div>

        {/* Order Context Pill (Mesa / Salón o Para Llevar status) */}
        <div className={`ui-context-pill ${isModalTakeOut ? 'is-takeout' : ''}`}>
          <div className="ui-context-pill-left">
            {isModalTakeOut ? (
              <>
                <ShoppingBag className="ui-context-pill-icon" />
                <span>PEDIDO PARA LLEVAR</span>
              </>
            ) : (
              <>
                <Utensils className="ui-context-pill-icon" />
                <span>PEDIDO EN MESA #{settlingOrder.tableId || 'S/M'}</span>
              </>
            )}
          </div>
          <span className={`ui-pill ui-pill-sm ui-pill-upper ui-pill-solid-blue ${isModalTakeOut ? 'is-takeout' : ''}`}>
            {isModalTakeOut ? 'LLEVAR' : 'SALÓN'}
          </span>
        </div>

        {/* Big Total Showcase (High Focus Area) */}
        <div className="cpos-spm-total-box">
          <span className="ui-label-xs ui-text-muted cpos-spm-total-label">Total a Cobrar</span>
          <span className="ui-price-hero cpos-spm-total-val">{formatCOP(settlingOrder.total)}</span>
        </div>

        {/* PAYMENT METHOD SELECTOR (Identical to POS Front Payment Styles) */}
        <div className="cpos-spm-pay-section">
          <div className="cpos-spm-pay-label-row">
            <label className="ui-label-md cpos-spm-pay-label">Método de pago recibido:</label>
          </div>

          <PaymentMethodTabs methods={enabledPaymentMethods} value={settlePayMethod} onChange={setSettlePayMethod} />

          {settlePayMethod === 'CASH' && (
            <>
              {/* Tendered Amount Numeric Field */}
              <div className="cpos-pay-tendered-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Monto entregado en COP"
                  value={settleCashTendered}
                  onChange={(e) => setSettleCashTendered(e.target.value)}
                  className="cpos-spm-tendered-input ui-tabular"
                />
              </div>

              {/* Quick Cash Denomination Chips */}
              <div className="cpos-pay-denoms-grid">
                {[
                  { label: 'Exacto', val: totalCOP },
                  { label: '$20k', val: 20000 },
                  { label: '$50k', val: 50000 },
                  { label: '$100k', val: 100000 }
                ].map((den) => (
                  <button
                    key={den.label}
                    type="button"
                    onClick={() => {
                      sfx.playTap();
                      setSettleCashTendered(String(den.val));
                    }}
                    className="ui-pill-chip"
                  >
                    {den.label}
                  </button>
                ))}
              </div>

              {/* Change Amount Calculation (Cambio) */}
              <div className="cpos-spm-change-row">
                <span className="cpos-spm-change-label">Cambio:</span>
                <span
                  className={`cpos-spm-change-val ui-tabular ${
                    tenderedVal > 0 && !isEnoughCash ? 'is-under' : ''
                  }`}
                >
                  {tenderedVal > 0 && !isEnoughCash
                    ? 'Monto menor al total'
                    : `$${changeCOP.toLocaleString('es-CO')}`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Primary Action CTA Button: Confirmar Pago y Enviar a Cocina */}
        <div className="cpos-spm-confirm-wrap">
          <button
            type="button"
            disabled={isSubmitting || (settlePayMethod === 'CASH' && tenderedVal > 0 && !isEnoughCash)}
            onClick={onConfirm}
            className="ui-btn ui-btn-primary ui-btn-xl ui-btn-block cpos-spm-confirm-btn"
          >
            <CheckCircle2 className="ui-icon-20" />
            <span>
              {isSubmitting ? 'Procesando...' : 'Confirmar Pago y Enviar a Cocina'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

