import React, { useState, useEffect } from 'react';
import { useKdsStore, getOrderKdsStatus } from '../../store/useKdsStore';
import { getElapsedMinutes } from '../../utils/format';
import { usePixelShift } from '../../utils/usePixelShift';
import { ScreenResolutionBadge } from '../common/ScreenResolutionBadge';
import './TurnsBoard.css';

export function TurnsBoard() {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'columns'
  const activeOrders = useKdsStore((state) => state.activeOrders);
  const [, setTick] = useState(0);
  const { shiftClass } = usePixelShift();

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
    <div className={`tbrd-root ${shiftClass}`}>
      
      {/* Contenedor estilo TV Screen */}
      <div className="tbrd-s-1">
        
        {/* Banner Superior */}
        <header className="tbrd-s-2">
          <div className="tbrd-s-3">
            <div className="tbrd-s-4">
              <span className="tbrd-s-5">Servi<span className="tbrd-s-6">plus</span></span>
              <span className="tbrd-s-7">
                Monitor TV
              </span>
            </div>

            <h1 className="tbrd-s-8">
              Track Your Order • Estado de Pedidos
            </h1>

            <div className="tbrd-s-4">
              {/* Selector de modo de vista */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'table' ? 'columns' : 'table')}
                className="tbrd-s-9"
              >
                {viewMode === 'table' ? '▦ Ver Columnas' : '📊 Ver Tabla'}
              </button>

              <div className="tbrd-s-10">
                <span className="tbrd-s-11"></span>
                <span>En Vivo</span>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                title="Pantalla Completa"
                className="tbrd-s-12"
              >
                ⛶
              </button>
            </div>
          </div>

          {/* Sub-banner informativo */}
          <div className="tbrd-s-13">
            ⚡ ¡Pide en nuestro Kiosk autoservicio y ahorra tiempo! • Skip the line with our self-ordering Kiosk!
          </div>
        </header>

        {/* CONTENIDO: MODO 1 - TABLA CON BARRAS DE PROGRESO */}
        {viewMode === 'table' && (
          <div className="tbrd-s-14">
            {/* Header de la tabla */}
            <div className="tbrd-s-15">
              <div className="tbrd-s-16">Turno / Cliente</div>
              <div className="tbrd-s-17">Estado y Progreso</div>
              <div className="tbrd-s-18">Ubicación / Entrega</div>
            </div>

            {/* Filas */}
            <div className="tbrd-s-19">
              {allOrders.map((o, idx) => {
                const isReady = getOrderKdsStatus(o) === 'READY';
                const isOdd = idx % 2 === 0;

                if (isReady) {
                  return (
                    <article
                      key={o.id}
                      className={`tbrd-row-card is-ready ${isOdd ? 'is-odd' : ''}`}
                    >
                      <div className="tbrd-s-20">
                        <span className="tbrd-s-21">#{o.orderNumber || o.id}</span>
                        <span className="tbrd-s-22">
                          {o.tableId ? `Mesa ${o.tableId}` : 'Retirar'}
                        </span>
                      </div>

                      <div className="tbrd-s-17">
                        <div className="tbrd-s-23">
                          <span>¡Listo para retirar! / It's ready!</span>
                          <span className="tbrd-s-24">✓</span>
                        </div>
                      </div>

                      <div className="tbrd-s-25">
                        <span className={`tbrd-dest-pill ${o.tableId ? 'is-table' : ''}`}>
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
                  const bucketPct = Math.min(95, Math.max(15, Math.round(pct / 5) * 5));

                  return (
                    <article
                      key={o.id}
                      className={`tbrd-row-card ${isOdd ? 'is-odd' : ''}`}
                    >
                      <div className="tbrd-s-20">
                        <span className="tbrd-s-26">#{o.orderNumber || o.id}</span>
                        <span className="tbrd-s-27">
                          {o.tableId ? `Mesa ${o.tableId}` : 'Mostrador'}
                        </span>
                      </div>

                      <div className="tbrd-s-17">
                        <div className="tbrd-s-28">
                          <div className={`tbrd-progress-fill tbrd-progress-pct-${bucketPct}`}>
                            <span className="tbrd-s-29">¡Preparando! ({remaining} min est.)</span>
                          </div>
                          <span className="tbrd-s-30">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      <div className="tbrd-s-25">
                        <span className="tbrd-s-31">
                          ⏱️ ~{remaining} min est.
                        </span>
                      </div>
                    </article>
                  );
                }
              })}

              {allOrders.length === 0 && (
                <div className="tbrd-s-32">
                  <div className="tbrd-s-33">🎉</div>
                  <div className="tbrd-s-34">No hay pedidos en espera</div>
                  <p className="tbrd-s-35">Las órdenes creadas en Kiosco o Cocina aparecerán aquí automáticamente</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO: MODO 2 - DOS COLUMNAS TRADICIONALES */}
        {viewMode === 'columns' && (
          <div className="tbrd-s-36">
            {/* Columna En Preparación */}
            <div className="tbrd-s-37">
              <div className="tbrd-s-38">
                <span className="tbrd-s-39">🍳 EN PREPARACIÓN</span>
                <span className="tbrd-s-40">{prepOrders.length}</span>
              </div>
              <div className="tbrd-s-41">
                {prepOrders.map((o) => (
                  <div key={o.id} className="tbrd-s-42">
                    <div className="tbrd-s-43">#{o.orderNumber || o.id}</div>
                    <div className="tbrd-s-44">{o.tableId ? `Mesa ${o.tableId}` : 'Para Llevar'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna Listas */}
            <div className="tbrd-s-45">
              <div className="tbrd-s-46">
                <span className="tbrd-s-47">🟢 LISTAS PARA ENTREGA</span>
                <span className="tbrd-s-48">{readyOrders.length}</span>
              </div>
              <div className="tbrd-s-41">
                {readyOrders.map((o) => (
                  <div key={o.id} className="tbrd-s-49">
                    <div className="tbrd-s-50">#{o.orderNumber || o.id}</div>
                    <div className="tbrd-s-51">{o.tableId ? `Mesa ${o.tableId}` : 'Para Llevar'}</div>
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
