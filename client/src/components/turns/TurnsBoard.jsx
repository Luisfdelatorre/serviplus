import React, { useState, useEffect } from 'react';
import { useKdsStore, getOrderKdsStatus } from '../../store/useKdsStore';
import { getElapsedMinutes } from '../../utils/format';
import { usePixelShift } from '../../utils/usePixelShift';
import { ScreenResolutionBadge } from '../common/ScreenResolutionBadge';

export function TurnsBoard() {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'columns'
  const activeOrders = useKdsStore((state) => state.activeOrders);
  const [, setTick] = useState(0);
  const { style: pixelShiftStyle } = usePixelShift();

  // Ticker de 15s para actualizar barras de progreso
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const validOrders = (activeOrders || []).filter((o) => o.status !== '3');

  // Listos (últimas 10 horas)
  const readyOrders = validOrders
    .filter((o) => getOrderKdsStatus(o) === 'READY' && getElapsedMinutes(o.createdAt) <= 600)
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return (tB - tA) || (b.id - a.id);
    });

  // En Preparación
  const prepOrders = validOrders
    .filter((o) => getOrderKdsStatus(o) === 'PREPARING')
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return (tA - tB) || (a.id - b.id);
    });

  const allOrders = [...readyOrders, ...prepOrders];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 65px)', background: '#0d1215', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden', boxSizing: 'border-box', ...pixelShiftStyle }}>
      
      {/* Contenedor estilo TV Screen */}
      <div style={{ background: '#ffffff', borderRadius: '20px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', border: '1px solid #e2e8f0' }}>
        
        {/* Banner Superior */}
        <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#e11d48' }}>Servi<span style={{ color: '#0f172a' }}>plus</span></span>
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                Monitor TV
              </span>
            </div>

            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', letterSpacing: '0.04em' }}>
              Track Your Order • Estado de Pedidos
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Selector de modo de vista */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'table' ? 'columns' : 'table')}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {viewMode === 'table' ? '▦ Ver Columnas' : '📊 Ver Tabla'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                <span>En Vivo</span>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                title="Pantalla Completa"
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ⛶
              </button>
            </div>
          </div>

          {/* Sub-banner informativo */}
          <div style={{ background: '#fbbf24', padding: '7px 20px', textAlign: 'center', color: '#0f172a', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            ⚡ ¡Pide en nuestro Kiosk autoservicio y ahorra tiempo! • Skip the line with our self-ordering Kiosk!
          </div>
        </header>

        {/* CONTENIDO: MODO 1 - TABLA CON BARRAS DE PROGRESO */}
        {viewMode === 'table' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', overflowY: 'auto' }}>
            {/* Header de la tabla */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px', padding: '8px 16px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>
              <div style={{ gridColumn: 'span 3' }}>Turno / Cliente</div>
              <div style={{ gridColumn: 'span 6' }}>Estado y Progreso</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>Ubicación / Entrega</div>
            </div>

            {/* Filas */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {allOrders.map((o, idx) => {
                const isReady = getOrderKdsStatus(o) === 'READY';
                const isOdd = idx % 2 === 0;

                if (isReady) {
                  return (
                    <article
                      key={o.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        gap: '16px',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        background: isOdd ? '#ffffff' : '#f8fafc',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>#{o.orderNumber || o.id}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          {o.tableId ? `Mesa ${o.tableId}` : 'Retirar'}
                        </span>
                      </div>

                      <div style={{ gridColumn: 'span 6' }}>
                        <div style={{ width: '100%', height: '36px', borderRadius: '999px', background: '#00B074', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', color: '#ffffff', fontWeight: 800, fontSize: '0.88rem' }}>
                          <span>¡Listo para retirar! / It's ready!</span>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ffffff', color: '#00B074', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem' }}>✓</span>
                        </div>
                      </div>

                      <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ padding: '6px 18px', borderRadius: '999px', background: o.tableId ? '#F59E0B' : '#E53935', color: '#ffffff', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                          {o.tableId ? `Mesa ${o.tableId}` : 'Mostrador'}
                        </span>
                      </div>
                    </article>
                  );
                } else {
                  const elapsed = getElapsedMinutes(o.createdAt);
                  const maxPrep = o.maxPrepTime || 12;
                  const remaining = Math.max(0, maxPrep - elapsed);
                  const pct = Math.min(95, Math.max(15, Math.round((elapsed / maxPrep) * 100)));

                  return (
                    <article
                      key={o.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        gap: '16px',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        background: isOdd ? '#ffffff' : '#f8fafc',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>#{o.orderNumber || o.id}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                          {o.tableId ? `Mesa ${o.tableId}` : 'Mostrador'}
                        </span>
                      </div>

                      <div style={{ gridColumn: 'span 6' }}>
                        <div style={{ width: '100%', height: '36px', borderRadius: '999px', background: '#f1f5f9', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#00B074', display: 'flex', alignItems: 'center', padding: '0 14px', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', transition: 'width 0.5s ease' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>¡Preparando! ({remaining} min est.)</span>
                          </div>
                          <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, fontSize: '0.8rem', color: '#64748b' }}>
                            {pct}%
                          </span>
                        </div>
                      </div>

                      <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ padding: '6px 14px', borderRadius: '999px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, fontSize: '0.85rem' }}>
                          ⏱️ ~{remaining} min est.
                        </span>
                      </div>
                    </article>
                  );
                }
              })}

              {allOrders.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '80px 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎉</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#475569' }}>No hay pedidos en espera</div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>Las órdenes creadas en Kiosco o Cocina aparecerán aquí automáticamente</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO: MODO 2 - DOS COLUMNAS TRADICIONALES */}
        {viewMode === 'columns' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '20px', gap: '20px', background: '#090d16', overflowY: 'auto' }}>
            {/* Columna En Preparación */}
            <div style={{ background: '#111827', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '3px solid #f59e0b', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#f59e0b', fontSize: '1.8rem', fontWeight: 900 }}>🍳 EN PREPARACIÓN</span>
                <span style={{ background: '#374151', color: '#f59e0b', padding: '3px 12px', borderRadius: '999px', fontWeight: 800 }}>{prepOrders.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                {prepOrders.map((o) => (
                  <div key={o.id} style={{ background: '#1f2937', border: '2px solid rgba(245, 158, 11, 0.4)', borderRadius: '14px', padding: '16px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#f59e0b' }}>#{o.orderNumber || o.id}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9ca3af', marginTop: '4px' }}>{o.tableId ? `Mesa ${o.tableId}` : 'Para Llevar'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna Listas */}
            <div style={{ background: '#064e3b', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '3px solid #10b981', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 900 }}>🟢 LISTAS PARA ENTREGA</span>
                <span style={{ background: '#047857', color: '#ffffff', padding: '3px 12px', borderRadius: '999px', fontWeight: 800 }}>{readyOrders.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                {readyOrders.map((o) => (
                  <div key={o.id} style={{ background: 'rgba(16, 185, 129, 0.25)', border: '2px solid #10b981', borderRadius: '14px', padding: '16px 8px', textAlign: 'center', animation: 'pulseReady 1.5s infinite' }}>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff' }}>#{o.orderNumber || o.id}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{o.tableId ? `Mesa ${o.tableId}` : 'Para Llevar'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Indicador de resolución del televisor en la esquinita */}
      <ScreenResolutionBadge position="bottom-right" />
    </div>
  );
}
