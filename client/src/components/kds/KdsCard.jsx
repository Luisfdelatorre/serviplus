import React from 'react';
import { useKdsStore, getOrderKdsStatus } from '../../store/useKdsStore';
import { formatRegularTime, getElapsedMinutes } from '../../utils/format';
import { useI18n } from '../../i18n';
import { sfx } from '../../utils/audio';

export function KdsCard({ order }) {
  const toggleItemCheck = useKdsStore((state) => state.toggleItemCheck);
  const setOrderState = useKdsStore((state) => state.setOrderState);
  const kdsItemChecks = useKdsStore((state) => state.kdsItemChecks);
  const { t } = useI18n();

  const kdsStatus = getOrderKdsStatus(order);
  const elapsedMinutes = getElapsedMinutes(order.createdAt);
  const orderTimeStr = order.createdAt ? formatRegularTime(order.createdAt) : '';

  let elapsedText = '';
  if (elapsedMinutes < 60) {
    elapsedText = `${elapsedMinutes} ${t('kds_min')}`;
  } else if (elapsedMinutes < 1440) {
    const hrs = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    elapsedText = `${hrs}${t('kds_h')} ${mins}${t('kds_m')}`;
  } else {
    elapsedText = `>24${t('kds_h')}`;
  }

  let urgencyClass = 'urgency-green';
  if (kdsStatus === 'READY') {
    urgencyClass = 'urgency-emerald';
  } else if (elapsedMinutes >= 15) {
    urgencyClass = 'urgency-red';
  }

  const isTakeOut = order.orderType === 2 || !order.tableId;
  const orderTitle = isTakeOut
    ? t('kds_order_title_takeout', { orderNumber: order.orderNumber })
    : t('kds_order_title_table', { orderNumber: order.orderNumber, table: order.tableId });

  // Acción interactiva en todo el banner / cabecera de la comanda
  const handleHeaderAction = () => {
    try { sfx.playReadyChime(); } catch (_) {}
    if (kdsStatus === 'READY') {
      setOrderState(order.id, 'SERVED');
    } else {
      setOrderState(order.id, 'READY');
    }
  };

  return (
    <div className={`kds-card ${urgencyClass}`}>
      {/* Header Interactivo: todo el banner cambia el estado y porta el checkmark a la derecha */}
      <div
        className="kds-card-header kds-header-clickable"
        onClick={handleHeaderAction}
        title={kdsStatus === 'READY' ? 'Comanda Lista • Clic para marcar como ENTREGADO' : 'En Preparación • Clic para marcar como LISTO'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="kds-header-title">{orderTitle}</span>
        </div>

        <div className="kds-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="kds-elapsed-pill" id={`kds-elapsed-${order.id}`}>⏱️ {elapsedText}</span>
          {orderTimeStr && <span className="kds-entry-time">{orderTimeStr}</span>}

          {/* Botón Revertir si está READY */}
          {kdsStatus === 'READY' && (
            <button
              type="button"
              className="kds-header-revert-btn"
              title={t('kds_aria_revert')}
              onClick={(e) => {
                e.stopPropagation();
                try { sfx.playTap(); } catch (_) {}
                setOrderState(order.id, 'PREPARING');
              }}
            >
              <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 10h10a5 5 0 0 1 5 5v2m-15-7l4-4m-4 4l4 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>
          )}

          {/* Checkmark destacado en el top banner right */}
          <div
            className={`kds-header-checkmark-badge ${kdsStatus === 'READY' ? 'is-ready' : 'is-prep'}`}
            title={kdsStatus === 'READY' ? 'Listo (Clic para Entregar)' : 'Marcar como Listo'}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Items List (Aprovecha el 100% del espacio vertical libre sin botonera inferior) */}
      <div className="kds-card-items">
        {(order.items || []).map((it, idx) => {
          const checkKey = `${order.id}_${it.id || idx}`;
          const isChecked = !!(order.kdsItemChecks && order.kdsItemChecks[checkKey]) || !!kdsItemChecks[checkKey];
          return (
            <div
              key={it.id || idx}
              className={`kds-item-row ${isChecked ? 'checked' : ''}`}
              onClick={() => toggleItemCheck(order.id, it.id || idx)}
            >
              <div className="kds-item-left" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="kds-item-text">
                  <strong>{it.quantity} x</strong> {it.name}
                </span>

                {it.modifiers && it.modifiers.length > 0 && (
                  <span
                    className="kds-item-text"
                    style={{
                      fontSize: '0.78rem',
                      color: '#b45309',
                      fontWeight: 700,
                      marginTop: '2px',
                      lineHeight: 1.2
                    }}
                  >
                    + {it.modifiers.map((m) => (typeof m === 'object' ? m.name : m)).join(', ')}
                  </span>
                )}

                {it.notes && (
                  <span
                    className="kds-item-text"
                    style={{
                      fontSize: '0.74rem',
                      color: '#64748b',
                      fontStyle: 'italic',
                      marginTop: '2px'
                    }}
                  >
                    📝 {it.notes}
                  </span>
                )}
              </div>
              <div className="kds-check-circle">{isChecked ? '✓' : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}