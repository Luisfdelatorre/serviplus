import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMenuStore } from '../../store/useMenuStore';
import { openCashShift, fetchEmployees, fetchCurrentCashShift, printCashShiftSlip, openCashDrawer, fetchPublicConfig } from '../../api';
import { socket } from '../../socket';
import { sfx } from '../../utils/audio';
import { formatCurrency } from '../../utils/format';
import { getDenominationsForCurrency } from '../../config/currencyDenominations';
import { UpayLogo } from '../common/UpayLogo';
import './CashDrawerOpening.css';

export function CashDrawerOpeningView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveTab = useMenuStore((state) => state.setActiveTab);
  const openAdminLogin = useMenuStore((state) => state.openAdminLogin);
  const sessionEmployee = useMenuStore((state) => state.sessionEmployee);

  // Estado real de conectividad (Socket.io + Red)
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [stationName, setStationName] = useState('POS #01');
  const [storeBrand, setStoreBrand] = useState('UPAY SOLUTIONS');
  const [storeSub, setStoreSub] = useState('S.A.S. • SMART RETAIL TECH');

  // Fecha y hora dinámica
  const [dateTimeString, setDateTimeString] = useState('');

  // Moneda activa del sistema (default COP, se sincroniza con fetchPublicConfig)
  const [currency, setCurrency] = useState('COP');

  // Denominaciones de Billetes y Monedas (inicializadas dinámicamente según la moneda en 0)
  const [denominations, setDenominations] = useState(() => getDenominationsForCurrency('COP'));

  // Denominación activa para edición rápida con el keypad
  const [activeRowId, setActiveRowId] = useState(() => {
    const initialList = getDenominationsForCurrency('COP');
    return initialList[0]?.id || '100k';
  });

  // Ingresos en Línea (Exclusivo Quioscos Autoservicio • Inicia en $0 al aperturar turno)
  const [onlineTransactions, setOnlineTransactions] = useState([]);

  // Modal de éxito
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registeredTotal, setRegisteredTotal] = useState(0);
  const [openingNotes, setOpeningNotes] = useState('Apertura Inicial');

  // Actualizador dinámico de fecha y hora
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const rawDate = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      const capitalized = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setDateTimeString(`${capitalized} • ${time}`);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Escuchar estado real de conexión (Socket.io y navegador)
  useEffect(() => {
    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);
    const onOnline = () => setIsSocketConnected(socket.connected);
    const onOffline = () => setIsSocketConnected(false);

    setIsSocketConnected(socket.connected);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Cargar datos de la tienda / estación y moneda configurada
    fetchPublicConfig().then((cfg) => {
      if (cfg && cfg.restaurant) {
        if (cfg.restaurant.legalName) setStoreBrand(cfg.restaurant.legalName);
        else if (cfg.restaurant.name) setStoreBrand(cfg.restaurant.name);
        if (cfg.restaurant.nit) setStoreSub(`NIT: ${cfg.restaurant.nit} • TERMINAL PRINCIPAL`);
      }
      const activeCurr = (cfg?.kiosk?.currency || cfg?.wompi?.currency || cfg?.currency || 'COP').toUpperCase();
      setCurrency(activeCurr);
      const configuredDenoms = getDenominationsForCurrency(activeCurr);
      setDenominations(configuredDenoms);
      if (configuredDenoms.length > 0) {
        setActiveRowId(configuredDenoms[0].id);
      }
    }).catch(() => { });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Cálculos matemáticos en vivo
  const totalCash = denominations.reduce((acc, row) => acc + (row.qty * row.unitValue), 0);
  const totalPieces = denominations.reduce((acc, row) => acc + row.qty, 0);
  const grandTotal = totalCash;
  const activeRow = denominations.find((d) => d.id === activeRowId) || denominations[0] || { label: '', qty: 0 };

  // Selección de fila activa
  const handleSelectRow = (id) => {
    try { sfx.playTap(); } catch (_) { }
    setActiveRowId(id);
  };

  // Botones + y - de fila
  const handleQtyChange = (id, delta) => {
    try { sfx.playTap(); } catch (_) { }
    setActiveRowId(id);
    setDenominations((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const nextQty = Math.max(0, row.qty + delta);
          return { ...row, qty: nextQty };
        }
        return row;
      })
    );
  };

  // Botones de incremento rápido (+1, +5, +10, +20)
  const handleFastAdd = (inc) => {
    try { sfx.playTap(); } catch (_) { }
    setDenominations((prev) =>
      prev.map((row) => {
        if (row.id === activeRowId) {
          return { ...row, qty: row.qty + inc };
        }
        return row;
      })
    );
  };

  // Numpad táctil virtual
  const handleKeypadPress = (key) => {
    try { sfx.playTap(); } catch (_) { }
    setDenominations((prev) =>
      prev.map((row) => {
        if (row.id === activeRowId) {
          let currentStr = row.qty.toString();
          let nextQty = row.qty;

          if (key === 'C') {
            nextQty = 0;
          } else if (key === '00') {
            if (currentStr === '0') {
              nextQty = 0;
            } else {
              nextQty = parseInt(currentStr + '00', 10) || 0;
            }
          } else {
            if (currentStr === '0') {
              nextQty = parseInt(key, 10) || 0;
            } else {
              nextQty = parseInt(currentStr + key, 10) || 0;
            }
          }

          return { ...row, qty: Math.min(nextQty, 9999) };
        }
        return row;
      })
    );
  };

  // Limpiar todo a 0
  const handleResetAll = () => {
    try { sfx.playTap(); } catch (_) { }
    setDenominations((prev) => prev.map((row) => ({ ...row, qty: 0 })));
  };

  // Confirmar y abrir turno de caja
  const handleSubmitOpening = async () => {
    try {
      setSubmitting(true);
      try { sfx.playTap(); } catch (_) { }

      const cashierId = (sessionEmployee && sessionEmployee.id) || 1;
      const cashierName = (sessionEmployee && sessionEmployee.name) || 'Juan Pérez';

      const notesPrefix = (openingNotes || 'Apertura Inicial').trim();
      const breakdown = denominations.filter(d => d.qty > 0).map(d => `${d.qty}x ${d.label}`).join(', ');
      const shiftNotes = `${notesPrefix}${breakdown ? ` | Desglose: ${breakdown}` : ''}`;

      await openCashShift({
        cashierId,
        cashierName,
        initialCash: totalCash,
        notes: shiftNotes
      });

      queryClient.invalidateQueries({ queryKey: ['cash-shift', 'current'] });

      try { sfx.playSuccess(); } catch (_) { }
      setRegisteredTotal(totalCash);
      setShowSuccessModal(true);
    } catch (err) {
      try { sfx.playBeep(); } catch (_) { }
      alert('Error abriendo turno: ' + (err.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToPos = () => {
    try { sfx.playTap(); } catch (_) { }
    setShowSuccessModal(false);
    navigate('/front');
  };

  return (
    <div className="cdo-container">
      {/* BEGIN: MainHeader */}
      <header className="cdo-header">
        <div className="cdo-brand-group">
          <div className="cdo-brand-logo">
            <UpayLogo size={22} className="cdo-brand-svg" />
          </div>
          <div>
            <div className="cdo-brand-title">
              <span className="upay">UPAY</span>
              <span className="solutions">SOLUTIONS</span>
            </div>
            <p className="cdo-brand-sub">S.A.S. • SMART RETAIL TECH</p>
          </div>

          <div className={`ui-pill ui-pill-xs ui-pill-emerald ${isSocketConnected ? '' : 'offline'}`}>
            <span className={`ui-dot-ping ${isSocketConnected ? '' : 'offline'}`}>
              <span className="ring"></span>
              <span className="dot"></span>
            </span>
            <span>{isSocketConnected ? 'En línea' : 'Desconectado'}</span>
          </div>

          <div className="ui-station-badge">
            <span><strong>POS 01</strong></span>
            <span>•</span>
            <span><strong>{sessionEmployee?.name || ''}</strong></span>
            <span>•</span>
            <span className={`ui-pill ui-pill-xs ui-pill-emerald ${isSocketConnected ? 'online' : 'offline'}`}>
              <span className={`ui-dot ${isSocketConnected ? 'online' : 'offline'}`}></span>
              {isSocketConnected ? 'Kiosk online' : 'Servidor Desconectado'}
            </span>
          </div>
        </div>

        <div className="cdo-header-actions">
          <button
            className="ui-btn ui-btn-secondary ui-btn-sm cdo-action-btn"
            type="button"
            onClick={() => {
              try { sfx.playTap(); } catch (_) { }
              navigate('/');
            }}
          >
            <svg className="ui-icon-16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
            <span>Regresar al Hub</span>
          </button>
        </div>
      </header>
      {/* END: MainHeader */}

      {/* BEGIN: ContentArea */}
      <main className="cdo-main">
        {/* Title and Subtitle Block */}
        <div className="cdo-title-bar">
          <div className="cdo-title-left">
            <div className="cdo-title-icon">
              <svg className="ui-icon-24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <div className="cdo-title-text">
              <h1>Entrada Cajero</h1>
            </div>
          </div>

          <div className="ui-pill ui-pill-sm ui-pill-surface">
            <span className="cdo-date-label">Fecha de Arqueo:</span>
            <span className="cdo-mono cdo-date-val">
              {dateTimeString || ''}
            </span>
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="cdo-grid">
          {/* COLUMN 1: Breakdown of Bills & Coins */}
          <section className="cdo-card">
            <div>
              <div className="cdo-card-header">
                <div>
                  <h2>Billetes y Monedas ({currency})</h2>
                </div>
                <button
                  className="cdo-reset-btn"
                  type="button"
                  onClick={handleResetAll}
                  title="Reiniciar todos los contadores a 0"
                >
                  Limpiar Todo
                </button>
              </div>

              {/* Denomination Items List */}
              <div className="cdo-denominations-list">
                {denominations.map((row) => {
                  const isActive = row.id === activeRowId;
                  const rowSubtotal = row.qty * row.unitValue;
                  return (
                    <div
                      key={row.id}
                      className={`cdo-row ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectRow(row.id)}
                    >
                      <div className="cdo-row-info">
                        <span className={`ui-denom-bar denom-${row.id}`}></span>
                        <div>
                          <div className="cdo-row-name">{row.label}</div>
                          <div className="cdo-row-sub">{row.type}</div>
                        </div>
                      </div>

                      <div className="cdo-row-controls">
                        <button
                          className="cdo-qty-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQtyChange(row.id, -1);
                          }}
                        >
                          -
                        </button>
                        <input
                          className="cdo-qty-input cdo-mono"
                          type="text"
                          readOnly
                          value={row.qty}
                        />
                        <button
                          className="cdo-qty-btn plus"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQtyChange(row.id, 1);
                          }}
                        >
                          +
                        </button>
                      </div>

                      <div className="cdo-row-subtotal cdo-mono">
                        {formatCurrency(rowSubtotal, currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subtotal Cash Banner */}
            <div className="cdo-subtotal-banner">
              <div className="label">
                <span className="ui-dot lg teal"></span>
                <span>Piezas Contadas: <strong className="cdo-summary-highlight">{totalPieces}</strong></span>
              </div>
              <span className="amount cdo-mono">
                {formatCurrency(totalCash, currency)}
              </span>
            </div>
          </section>

          {/* COLUMN 3: Keypad & Final Checkout */}
          <section className="cdo-card cdo-keypad-card">
            <div>
              {/* Active Target Display */}
              <div className="cdo-target-display">
                <div className="cdo-target-header">
                  <span>Edición Rápida Táctil</span>
                  <span className="highlight">Denominación: {activeRow.label}</span>
                </div>
                <div className="cdo-target-value">
                  <span className="cdo-active-denom-count-label">Piezas:</span>
                  <span className="num cdo-mono">{activeRow.qty}</span>
                </div>
              </div>

              {/* Quick Increment Buttons (+1, +5, +10, +20) */}
              <div className="cdo-fast-add-grid">
                {[1, 5, 10, 20].map((inc) => (
                  <button
                    key={inc}
                    className="cdo-fast-btn"
                    type="button"
                    onClick={() => handleFastAdd(inc)}
                  >
                    +{inc}
                  </button>
                ))}
              </div>

              {/* Virtual Numpad */}
              <div className="cdo-numpad-grid">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((key) => (
                  <button
                    key={key}
                    className="cdo-key-btn"
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                  >
                    {key}
                  </button>
                ))}
                <button
                  className="cdo-key-btn clear"
                  type="button"
                  onClick={() => handleKeypadPress('C')}
                >
                  Borrar
                </button>
                <button
                  className="cdo-key-btn"
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                >
                  0
                </button>
                <button
                  className="cdo-key-btn double-zero"
                  type="button"
                  onClick={() => handleKeypadPress('00')}
                >
                  00
                </button>
              </div>
            </div>

            {/* Master Total & Submit Buttons */}
            <div className="cdo-breakdown-col">
              <div className="cdo-master-total">
                <div className="cdo-master-label">Total General de Apertura</div>
                <div className="cdo-master-amount cdo-mono">
                  {formatCurrency(totalCash, currency)}{' '}
                  <span className="cdo-total-cop-unit">{currency}</span>
                </div>
              </div>

              {/* Print Slip Option */}
              <button
                className="ui-btn ui-btn-secondary ui-btn-sm ui-btn-block cdo-print-slip-btn"
                type="button"
                onClick={async () => {
                  try { sfx.playTap(); } catch (_) { }
                  try {
                    await printCashShiftSlip({
                      cashierName: sessionEmployee?.name || 'Cajero Central',
                      initialCash: totalCash,
                      notes: openingNotes || 'Apertura de turno de caja'
                    }, false);
                    alert('🖨️ Comprobante de apertura enviado a la impresora térmica POS-58.');
                  } catch (err) {
                    console.warn('Error imprimiendo comprobante:', err);
                    window.print();
                  }
                }}
              >
                <svg className="ui-icon-16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span>Imprimir Comprobante de Arqueo</span>
              </button>

              {/* Primary Submit Button */}
              <button
                className="ui-btn ui-btn-primary ui-btn-md ui-btn-block cdo-submit-btn"
                type="button"
                disabled={submitting}
                onClick={handleSubmitOpening}
              >
                <svg className="ui-icon-20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span>{submitting ? 'Aperturando Turno...' : 'Confirmar y Abrir Turno de Caja'}</span>
              </button>
            </div>
          </section>
        </div>
      </main>
      {/* END: ContentArea */}

      {/* BEGIN: SuccessModal */}
      {showSuccessModal && (
        <div className="cdo-modal-overlay">
          <div className="cdo-modal-card">
            <div className="cdo-modal-icon-wrap">
              <svg className="ui-icon-32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <h3 className="cdo-modal-title">
              ¡Caja Abierta Exitosamente!
            </h3>
            <p className="cdo-modal-desc">
              El arqueo inicial de <strong className="cdo-summary-highlight">{formatCurrency(registeredTotal, currency)}</strong> ha quedado registrado. Se ha emitido la orden y la gaveta está habilitada para facturar.
            </p>
            <button
              className="ui-btn ui-btn-primary ui-btn-lg ui-btn-block cdo-modal-btn"
              type="button"
              onClick={handleGoToPos}
            >
              Ir a Punto de Venta (POS)
            </button>
          </div>
        </div>
      )}
      {/* END: SuccessModal */}
    </div>
  );
}

export default CashDrawerOpeningView;

