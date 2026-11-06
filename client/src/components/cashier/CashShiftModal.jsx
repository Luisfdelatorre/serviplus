import React, { useState, useEffect } from 'react';
import { fetchCurrentCashShift, openCashShift, closeCashShift, fetchCashShiftHistory, fetchEmployees, printCashShiftSlip } from '../../api';
import { formatCOP } from '../../utils/format';
import { sfx } from '../../utils/audio';
import {
  DollarSign,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  X,
  CreditCard,
  QrCode,
  FileText,
  History,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export function CashShiftModal({ isOpen, onClose }) {
  const [shiftData, setShiftData] = useState({ isOpen: false, shift: null });
  const [employees, setEmployees] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history'

  // Formulario Apertura
  const [openCashierId, setOpenCashierId] = useState(1);
  const [openCashierName, setOpenCashierName] = useState('Cajero Principal');
  const [initialCash, setInitialCash] = useState('150000');
  const [openNotes, setOpenNotes] = useState('Base para cambio inicial');

  // Formulario Cierre
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shiftRes, empRes, histRes] = await Promise.all([
        fetchCurrentCashShift().catch(() => ({ isOpen: false, shift: null })),
        fetchEmployees().catch(() => []),
        fetchCashShiftHistory().catch(() => [])
      ]);

      setShiftData(shiftRes || { isOpen: false, shift: null });
      setEmployees(empRes || []);
      setHistory(histRes || []);

      if (empRes && empRes.length > 0) {
        setOpenCashierId(empRes[0].id || 1);
        setOpenCashierName(empRes[0].name || 'Cajero Principal');
      }

      // Si hay turno abierto, sugerir el monto esperado en el input de cierre
      if (shiftRes?.isOpen && shiftRes.shift) {
        setActualCash(String(shiftRes.shift.expectedCashInDrawer || ''));
      }
    } catch (err) {
      console.error('Error cargando turno de caja:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      sfx.playTap();
      const numInitial = parseFloat(initialCash) || 0;
      await openCashShift({
        cashierId: openCashierId,
        cashierName: openCashierName,
        initialCash: numInitial,
        notes: openNotes
      });
      sfx.playSuccess();
      await loadData();
    } catch (err) {
      console.error('Error abriendo turno:', err);
      alert('Error al abrir turno: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!window.confirm('¿Confirmas el Cierre Z de este turno de caja? Se emitirá el balance definitivo.')) {
      return;
    }

    try {
      setSubmitting(true);
      sfx.playTap();
      const numActual = parseFloat(actualCash) || 0;
      const closedShift = await closeCashShift({
        actualCashInDrawer: numActual,
        closedBy: shiftData.shift?.cashierName || 'Cajero',
        notes: closeNotes
      });
      // Imprimir comprobante físico de Corte Z en la impresora térmica
      try {
        await printCashShiftSlip(closedShift, true);
      } catch (printErr) {
        console.warn('Error imprimiendo corte Z:', printErr.message);
      }
      sfx.playSuccess();
      await loadData();
    } catch (err) {
      console.error('Error cerrando turno:', err);
      alert('Error al cerrar turno: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentShift = shiftData?.shift;
  const isShiftOpen = shiftData?.isOpen && currentShift;

  // Cálculos en vivo para cierre
  const expectedCash = currentShift ? (currentShift.expectedCashInDrawer || 0) : 0;
  const countedCash = parseFloat(actualCash) || 0;
  const diff = countedCash - expectedCash;

  return (
    <div className="admin-modal-overlay">
      <div className="admin-settings-container" style={{ maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="admin-settings-header" style={{ paddingBottom: '16px' }}>
          <div className="admin-settings-title-group">
            <div className="admin-header-badge" style={{ background: isShiftOpen ? '#10b981' : '#f59e0b' }}>
              <DollarSign size={22} color="#fff" />
            </div>
            <div>
              <h2>Control de Caja (Turnos y Arqueo Z)</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: isShiftOpen ? '#065f46' : '#78350f',
                    color: isShiftOpen ? '#34d399' : '#fcd34d'
                  }}
                >
                  {isShiftOpen ? <Unlock size={12} /> : <Lock size={12} />}
                  {isShiftOpen ? `Turno #${currentShift.shiftNumber} ABIERTO` : 'CAJA CERRADA'}
                </span>
                {isShiftOpen && (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Responsable: <strong>{currentShift.cashierName}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="admin-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        {/* Pestañas: Turno Actual vs Historial */}
        <div style={{ padding: '0 24px 12px 24px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('current')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'current' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <DollarSign size={16} />
            <span>Turno Actual</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'history' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <History size={16} />
            <span>Historial ({history.length})</span>
          </button>

          <button
            onClick={loadData}
            style={{
              marginLeft: 'auto',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: '#334155',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
          {activeTab === 'history' ? (
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#e2e8f0' }}>Historial de Turnos Cerrados</h3>
              {history.length === 0 ? (
                <p style={{ color: '#64748b' }}>No hay turnos registrados en el historial.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {history.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                          Turno #{h.shiftNumber} • {h.cashierName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {new Date(h.openedAt).toLocaleDateString()} {new Date(h.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              sfx.playTap();
                              try {
                                await printCashShiftSlip(h, true);
                                alert(`🖨️ Turno #${h.shiftNumber} enviado a la impresora térmica.`);
                              } catch (e) {
                                alert('Error al imprimir: ' + e.message);
                              }
                            }}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #475569',
                              background: '#0f172a',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}
                          >
                            🖨️ Imprimir
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span>Base: <strong>{formatCOP(h.initialCash || 0)}</strong></span>
                        <span>Ventas Efectivo: <strong>{formatCOP(h.sales?.cashTotal || 0)}</strong></span>
                        <span>Wompi QR: <strong>{formatCOP(h.sales?.wompiTotal || 0)}</strong></span>
                        <span>Total Ventas: <strong style={{ color: '#38bdf8' }}>{formatCOP(h.sales?.totalSales || 0)}</strong></span>
                        {h.closing && (
                          <span style={{ color: h.closing.difference >= 0 ? '#4ade80' : '#f87171' }}>
                            Diferencia: <strong>{formatCOP(h.closing.difference)}</strong> ({h.closing.statusDifference})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isShiftOpen ? (
            /* VISTA TURNO ABIERTO (ARQUEO EN VIVO + CORTE Z) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tarjetas de Balance en Vivo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> Base Inicial
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {formatCOP(currentShift.initialCash || 0)}
                  </div>
                </div>

                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DollarSign size={12} /> Efectivo Cobrado
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                    {formatCOP(currentShift.sales?.cashTotal || 0)}
                  </div>
                </div>

                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <QrCode size={12} /> Wompi QR / Transf.
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                    {formatCOP(currentShift.sales?.wompiTotal || 0)}
                  </div>
                </div>

                <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} /> Total Ventas ({currentShift.sales?.ordersCount || 0} ped.)
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa', marginTop: '4px' }}>
                    {formatCOP(currentShift.sales?.totalSales || 0)}
                  </div>
                </div>
              </div>

              {/* Botón Imprimir Arqueo en Vivo */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={async () => {
                    sfx.playTap();
                    try {
                      await printCashShiftSlip(currentShift, false);
                      alert('🖨️ Reporte de arqueo actual enviado a la impresora térmica POS-58.');
                    } catch (e) {
                      alert('Error al imprimir arqueo: ' + e.message);
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #38bdf8',
                    background: '#0f172a',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>🖨️</span>
                  <span>Imprimir Arqueo en Vivo (Ticket Parcial)</span>
                </button>
              </div>

              {/* Dinero Total Esperado en Gaveta Física */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                  border: '1px solid #2563eb',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Dinero Físico Esperado en Gaveta
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Base Inicial ({formatCOP(currentShift.initialCash || 0)}) + Ventas Efectivo ({formatCOP(currentShift.sales?.cashTotal || 0)})
                  </p>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                  {formatCOP(expectedCash)}
                </div>
              </div>

              {/* Formulario de Cierre Z */}
              <form onSubmit={handleCloseShift} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={16} color="#ef4444" /> Realizar Cierre de Turno (Corte Z)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Efectivo Contado Físicamente en Caja:
                    </label>
                    <input
                      type="number"
                      required
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '1.1rem',
                        fontWeight: 600
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Balance / Diferencia de Caja:
                    </label>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: diff === 0 ? '#064e3b' : (diff > 0 ? '#1e3a8a' : '#7f1d1d'),
                        color: diff === 0 ? '#34d399' : (diff > 0 ? '#93c5fd' : '#fca5a5'),
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{diff === 0 ? 'Exacto' : (diff > 0 ? 'Sobrante' : 'Faltante')}:</span>
                      <span>{formatCOP(diff)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Notas u observaciones de cierre (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Billetes rotos, propinas entregadas, etc."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Lock size={18} />
                  <span>{submitting ? 'Procesando Cierre Z...' : 'Confirmar Cierre de Turno y Arqueo Z'}</span>
                </button>
              </form>
            </div>
          ) : (
            /* VISTA CAJA CERRADA (FORMULARIO DE APERTURA) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#78350f',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#fef3c7'
                }}
              >
                <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '0.95rem' }}>La caja se encuentra cerrada</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    Abre el turno indicando la base de efectivo inicial para habilitar el control de ventas del día.
                  </p>
                </div>
              </div>

              <form onSubmit={handleOpenShift} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '18px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#f8fafc' }}>Apertura de Turno de Caja</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Cajero Responsable:
                    </label>
                    <select
                      value={openCashierId}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setOpenCashierId(id);
                        const emp = employees.find((x) => x.id === id);
                        if (emp) setOpenCashierName(emp.name);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} (ID: {emp.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Base de Dinero Inicial en Gaveta (COP):
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={initialCash}
                      onChange={(e) => setInitialCash(e.target.value)}
                      placeholder="150000"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '1.1rem',
                        fontWeight: 600
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Observaciones de apertura:
                    </label>
                    <input
                      type="text"
                      value={openNotes}
                      onChange={(e) => setOpenNotes(e.target.value)}
                      placeholder="Base para cambio inicial"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      marginTop: '8px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Unlock size={18} />
                    <span>{submitting ? 'Iniciando turno...' : '🟢 Abrir Turno de Caja'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
