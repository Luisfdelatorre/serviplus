import React, { useState, useEffect } from 'react';
import { fetchCurrentCashShift, openCashShift, closeCashShift, fetchCashShiftHistory, fetchEmployees, printCashShiftSlip } from '../../api';
import { formatCOP } from '../../utils/format';
import { sfx } from '../../utils/audio';
import './CashShiftModal.css';
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
      <div className="admin-settings-container cshift-s-1">
        {/* Header */}
        <div className="admin-settings-header cshift-s-2">
          <div className="admin-settings-title-group">
            <div className={`admin-header-badge ${isShiftOpen ? 'shift-open' : 'shift-closed'}`}>
              <DollarSign size={22} color="#fff" />
            </div>
            <div>
              <h2>Control de Caja (Turnos y Arqueo Z)</h2>
              <div className="cshift-s-3">
                <span className={`cshift-status-pill ${isShiftOpen ? 'open' : 'closed'}`}>
                  {isShiftOpen ? <Unlock size={12} /> : <Lock size={12} />}
                  {isShiftOpen ? `Turno #${currentShift.shiftNumber} ABIERTO` : 'CAJA CERRADA'}
                </span>
                {isShiftOpen && (
                  <span className="cshift-s-4">
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
        <div className="cshift-s-5">
          <button
            onClick={() => setActiveTab('current')}
            className={`cshift-tab-btn ${activeTab === 'current' ? 'active' : ''}`}
          >
            <DollarSign size={16} />
            <span>Turno Actual</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`cshift-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          >
            <History size={16} />
            <span>Historial ({history.length})</span>
          </button>

          <button
            onClick={loadData}
            className="cshift-s-6"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="cshift-s-7">
          {activeTab === 'history' ? (
            <div>
              <h3 className="cshift-s-8">Historial de Turnos Cerrados</h3>
              {history.length === 0 ? (
                <p className="cshift-s-9">No hay turnos registrados en el historial.</p>
              ) : (
                <div className="cshift-s-10">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="cshift-s-11"
                    >
                      <div className="cshift-s-12">
                        <span className="cshift-s-13">
                          Turno #{h.shiftNumber} • {h.cashierName}
                        </span>
                        <div className="cshift-s-14">
                          <span className="cshift-s-4">
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
                            className="cshift-s-15"
                          >
                            🖨️ Imprimir
                          </button>
                        </div>
                      </div>
                      <div className="cshift-s-16">
                        <span>Base: <strong>{formatCOP(h.initialCash || 0)}</strong></span>
                        <span>Ventas Efectivo: <strong>{formatCOP(h.sales?.cashTotal || 0)}</strong></span>
                        <span>Wompi QR: <strong>{formatCOP(h.sales?.wompiTotal || 0)}</strong></span>
                        <span>Total Ventas: <strong className="cshift-s-17">{formatCOP(h.sales?.totalSales || 0)}</strong></span>
                        {h.closing && (
                          <span className={h.closing.difference >= 0 ? 'cshift-diff-pos' : 'cshift-diff-neg'}>
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
            <div className="cshift-s-18">
              {/* Tarjetas de Balance en Vivo */}
              <div className="cshift-s-19">
                <div className="cshift-s-20">
                  <span className="cshift-s-21">
                    <Lock size={12} /> Base Inicial
                  </span>
                  <div className="cshift-s-22">
                    {formatCOP(currentShift.initialCash || 0)}
                  </div>
                </div>

                <div className="cshift-s-20">
                  <span className="cshift-s-23">
                    <DollarSign size={12} /> Efectivo Cobrado
                  </span>
                  <div className="cshift-s-24">
                    {formatCOP(currentShift.sales?.cashTotal || 0)}
                  </div>
                </div>

                <div className="cshift-s-20">
                  <span className="cshift-s-25">
                    <QrCode size={12} /> Wompi QR / Transf.
                  </span>
                  <div className="cshift-s-26">
                    {formatCOP(currentShift.sales?.wompiTotal || 0)}
                  </div>
                </div>

                <div className="cshift-s-27">
                  <span className="cshift-s-28">
                    <TrendingUp size={12} /> Total Ventas ({currentShift.sales?.ordersCount || 0} ped.)
                  </span>
                  <div className="cshift-s-29">
                    {formatCOP(currentShift.sales?.totalSales || 0)}
                  </div>
                </div>
              </div>

              {/* Botón Imprimir Arqueo en Vivo */}
              <div className="cshift-s-30">
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
                  className="cshift-s-31"
                >
                  <span>🖨️</span>
                  <span>Imprimir Arqueo en Vivo (Ticket Parcial)</span>
                </button>
              </div>

              {/* Dinero Total Esperado en Gaveta Física */}
              <div
                className="cshift-s-32"
              >
                <div>
                  <span className="cshift-s-33">
                    Dinero Físico Esperado en Gaveta
                  </span>
                  <p className="cshift-s-34">
                    Base Inicial ({formatCOP(currentShift.initialCash || 0)}) + Ventas Efectivo ({formatCOP(currentShift.sales?.cashTotal || 0)})
                  </p>
                </div>
                <div className="cshift-s-35">
                  {formatCOP(expectedCash)}
                </div>
              </div>

              {/* Formulario de Cierre Z */}
              <form onSubmit={handleCloseShift} className="cshift-s-36">
                <h4 className="cshift-s-37">
                  <Lock size={16} color="#ef4444" /> Realizar Cierre de Turno (Corte Z)
                </h4>

                <div className="cshift-s-38">
                  <div>
                    <label className="cshift-s-39">
                      Efectivo Contado Físicamente en Caja:
                    </label>
                    <input
                      type="number"
                      required
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      className="cshift-s-40"
                    />
                  </div>

                  <div>
                    <label className="cshift-s-39">
                      Balance / Diferencia de Caja:
                    </label>
                    <div
                      className={`cshift-diff-box ${diff === 0 ? 'exact' : diff > 0 ? 'surplus' : 'shortage'}`}
                    >
                      <span>{diff === 0 ? 'Exacto' : (diff > 0 ? 'Sobrante' : 'Faltante')}:</span>
                      <span>{formatCOP(diff)}</span>
                    </div>
                  </div>
                </div>

                <div className="cshift-s-41">
                  <label className="cshift-s-42">
                    Notas u observaciones de cierre (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Billetes rotos, propinas entregadas, etc."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    className="cshift-s-43"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="cshift-s-44"
                >
                  <Lock size={18} />
                  <span>{submitting ? 'Procesando Cierre Z...' : 'Confirmar Cierre de Turno y Arqueo Z'}</span>
                </button>
              </form>
            </div>
          ) : (
            /* VISTA CAJA CERRADA (FORMULARIO DE APERTURA) */
            <div className="cshift-s-18">
              <div
                className="cshift-s-45"
              >
                <AlertTriangle size={24} color="#f59e0b" className="cshift-s-46" />
                <div>
                  <h4 className="cshift-s-47">La caja se encuentra cerrada</h4>
                  <p className="cshift-s-48">
                    Abre el turno indicando la base de efectivo inicial para habilitar el control de ventas del día.
                  </p>
                </div>
              </div>

              <form onSubmit={handleOpenShift} className="cshift-s-49">
                <h3 className="cshift-s-50">Apertura de Turno de Caja</h3>

                <div className="cshift-s-51">
                  <div>
                    <label className="cshift-s-52">
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
                      className="cshift-s-53"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} (ID: {emp.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="cshift-s-52">
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
                      className="cshift-s-40"
                    />
                  </div>

                  <div>
                    <label className="cshift-s-52">
                      Observaciones de apertura:
                    </label>
                    <input
                      type="text"
                      value={openNotes}
                      onChange={(e) => setOpenNotes(e.target.value)}
                      placeholder="Base para cambio inicial"
                      className="cshift-s-53"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="cshift-s-54"
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
