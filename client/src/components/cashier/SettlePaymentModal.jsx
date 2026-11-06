import React from 'react';
import { formatCOP } from '../../utils/format';
import { sfx } from '../../utils/audio';

export function SettlePaymentModal({
  settlingOrder,
  settlePayMethod,
  setSettlePayMethod,
  settleCashTendered,
  setSettleCashTendered,
  isSubmitting,
  onClose,
  onConfirm
}) {
  if (!settlingOrder) return null;

  const isModalTakeOut = Number(settlingOrder.orderType) === 2 || !settlingOrder.tableId;
  const totalCOP = Math.round(settlingOrder.total * 1000);
  const tenderedVal = parseFloat(settleCashTendered) || 0;
  const isEnoughCash = tenderedVal >= totalCOP;

  return (
    <div className="cpos-s-110">
      <div className="cpos-s-111">
        <div className="cpos-s-112">
          <div>
            <div className="cpos-s-113">
              💵 Completar Pago de Orden
            </div>
            <div className="cpos-s-114">
              Turno #{settlingOrder.orderNumber || settlingOrder.id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cpos-s-115"
          >
            ✕
          </button>
        </div>

        {/* BANNER ULTRA VISIBLE: PARA LLEVAR VS EN MESA */}
        <div className={`cpos-settle-banner ${isModalTakeOut ? 'takeout' : 'dinein'}`}>
          <span className={`cpos-settle-banner-title ${isModalTakeOut ? 'takeout' : 'dinein'}`}>
            {isModalTakeOut ? '🥡 PEDIDO PARA LLEVAR' : `🍽️ PEDIDO EN MESA #${settlingOrder.tableId || 'S/M'}`}
          </span>
          <span className={`cpos-settle-banner-tag ${isModalTakeOut ? 'takeout' : 'dinein'}`}>
            {isModalTakeOut ? 'LLEVAR' : 'SALÓN'}
          </span>
        </div>

        {/* Cuadro destacado de monto */}
        <div className="cpos-s-116">
          <div className="cpos-s-117">Total a Cobrar</div>
          <div className="cpos-s-118">
            {formatCOP(settlingOrder.total)}
          </div>
        </div>

        {/* Selector de Método de Pago recibido en caja */}
        <div className="cpos-s-119">
          <div className="cpos-s-120">
            Método de pago recibido:
          </div>
          <div className="cpos-s-121">
            {[
              { id: 'CASH', label: '💵 Efectivo' },
              { id: 'CARD', label: '💳 Datáfono' },
              { id: 'WOMPI_QR', label: '📱 QR' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSettlePayMethod(m.id)}
                className={`cpos-settle-pay-btn ${settlePayMethod === m.id ? 'active' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Si es efectivo, cálculo de cambio con denominaciones */}
        {settlePayMethod === 'CASH' && (
          <div className="cpos-s-122">
            <input
              type="number"
              placeholder="Monto entregado en COP"
              value={settleCashTendered}
              onChange={(e) => setSettleCashTendered(e.target.value)}
              className="cpos-s-123"
            />

            <div className="cpos-s-75">
              {[
                { label: 'Exacto', val: totalCOP },
                { label: '$20k', val: 20000 },
                { label: '$50k', val: 50000 },
                { label: '$100k', val: 100000 }
              ].map((den) => (
                <button
                  key={den.label}
                  type="button"
                  onClick={() => { sfx.playTap(); setSettleCashTendered(String(den.val)); }}
                  className="cpos-s-76"
                >
                  {den.label}
                </button>
              ))}
            </div>

            {tenderedVal > 0 && (
              <div className={`cpos-settle-change-text ${isEnoughCash ? 'ok' : 'under'}`}>
                {isEnoughCash
                  ? `Cambio: $${Math.max(0, tenderedVal - totalCOP).toLocaleString('es-CO')}`
                  : 'Monto menor al total'}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onConfirm}
          className="cpos-s-124"
        >
          {isSubmitting ? 'Procesando...' : '✅ Confirmar Pago y Enviar a Cocina'}
        </button>
      </div>
    </div>
  );
}
