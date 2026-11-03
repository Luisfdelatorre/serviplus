import React from 'react';
import { useKdsStore, getOrderKdsStatus } from '../../store/useKdsStore';
import { formatRegularTime, getElapsedMinutes } from '../../utils/format';
import { useI18n } from '../../i18n';

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

  return (
    <div className={`kds-card ${urgencyClass}`}>
      {/* Header */}
      <div className="kds-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="kds-header-title">{orderTitle}</span>
        </div>
        <div className="kds-header-right">
          <span className="kds-elapsed-pill" id={`kds-elapsed-${order.id}`}>⏱️ {elapsedText}</span>
          {orderTimeStr && <span className="kds-entry-time">{orderTimeStr}</span>}
        </div>
      </div>

      {/* Items List */}
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

                {/*it.modifiers && it.modifiers.length > 0 && (
                  <span className="kds-item-text"
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
                )*/}

                {it.notes && (
                  <span className="kds-item-text"
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

      {/* Action Buttons */}
      <div className="kds-card-action">
        {kdsStatus === 'READY' ? (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
            <button
              type="button"
              aria-label={t('kds_aria_revert')}
              className="btn-kds-revert"
              onClick={() => setOrderState(order.id, 'PREPARING')}
            >
              <svg style={{ width: '15px', height: '15px', color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 10h10a5 5 0 0 1 5 5v2m-15-7l4-4m-4 4l4 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t('kds_aria_served')}
              className="btn-kds-served group"
              onClick={() => setOrderState(order.id, 'SERVED')}
            >
              <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '14px', height: '14px', color: '#ffffff', strokeWidth: 3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={{ whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>{t('kds_mark_served')}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={t('kds_aria_ready')}
            className="btn-kds-ready group"
            onClick={() => setOrderState(order.id, 'READY')}
          >
            <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: '14px', height: '14px', color: '#ffffff', strokeWidth: 3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>{t('kds_mark_ready')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
