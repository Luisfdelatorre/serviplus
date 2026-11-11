import { useState, useEffect } from 'react';
import { fetchCurrentCashShift, openCashShift, closeCashShift, fetchCashShiftHistory, fetchEmployees, printCashShiftSlip } from '../../api';
import { formatCurrency } from '../../utils/format';
import { sfx } from '../../utils/audio';
import { showAlert, showConfirm } from '../../store/useAlertDialogStore';
import './CashShiftModal.css';
import {
  DollarSign,
  Lock,
  Unlock,
  AlertTriangle,
  X,
  QrCode,
  CreditCard,
  History,
  TrendingUp,
  RefreshCw,
  Printer
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
      showAlert({ variant: 'error', title: 'No se pudo abrir el turno', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    const confirmed = await showConfirm({
      variant: 'warning',
      title: '¿Confirmas el Cierre Z?',
      description: 'Se cerrará este turno de caja y se emitirá el balance definitivo.',
      actionLabel: 'Cerrar turno',
    });
    if (!confirmed) {
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
      showAlert({ variant: 'error', title: 'No se pudo cerrar el turno', description: err.message });
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

  const diffStatus = diff === 0 ? 'exact' : diff > 0 ? 'surplus' : 'shortage';
  const diffLabel = { exact: 'Exacto', surplus: 'Sobrante', shortage: 'Faltante' }[diffStatus];

  return (
    <div className="admin-modal-overlay">
      <div className="admin-settings-container cshift-modal">
        {/* Header */}
        <div className="admin-settings-header">
          <div className="admin-settings-title-group">
            <div className={`ui-icon-box-xl ${isShiftOpen ? 'ui-icon-box-emerald' : 'ui-icon-box-amber'}`}>
              <DollarSign size={22} />
            </div>
            <div>
              <h2>Control de Caja</h2>
              <div className="cshift-header-meta">
                <span className={`ui-pill ui-pill-xs ui-pill-upper ${isShiftOpen ? 'ui-pill-emerald' : 'ui-pill-amber'}`}>
                  {isShiftOpen ? <Unlock size={12} /> : <Lock size={12} />}
                  {isShiftOpen ? `Turno #${currentShift.shiftNumber} abierto` : 'Caja cerrada'}
                </span>
                {isShiftOpen && (
                  <span className="cshift-muted">
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
        <div className="cshift-toolbar">
          <div className="ui-capsule">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`ui-capsule-btn ${activeTab === 'current' ? 'is-active' : ''}`}
            >
              <DollarSign size={16} />
              <span>Turno actual</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`ui-capsule-btn ${activeTab === 'history' ? 'is-active' : ''}`}
            >
              <History size={16} />
              <span>Historial ({history.length})</span>
            </button>
          </div>

          <button type="button" onClick={loadData} className="ui-btn ui-btn-tonal ui-btn-sm">
            <RefreshCw size={14} className={loading ? 'ui-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="cshift-body">
          {activeTab === 'history' ? (
            <div className="cshift-stack">
              <h3 className="cshift-section-title">Historial de turnos cerrados</h3>
              {history.length === 0 ? (
                <p className="cshift-empty">No hay turnos registrados en el historial.</p>
              ) : (
                <div className="cshift-history-list">
                  {history.map((h) => (
                    <div key={h.id} className="cshift-card cshift-history-item">
                      <div className="cshift-history-head">
                        <span className="cshift-history-title">
                          Turno #{h.shiftNumber} • {h.cashierName}
                        </span>
                        <div className="cshift-history-actions">
                          <span className="cshift-muted">
                            {new Date(h.openedAt).toLocaleDateString()} {new Date(h.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              sfx.playTap();
                              try {
                                await printCashShiftSlip(h, true);
                                showAlert({ variant: 'info', title: 'Comprobante enviado', description: `El turno #${h.shiftNumber} se envió a la impresora térmica.` });
                              } catch (e) {
                                showAlert({ variant: 'error', title: 'No se pudo imprimir', description: e.message });
                              }
                            }}
                            className="ui-btn ui-btn-secondary ui-btn-xs"
                          >
                            <Printer size={14} />
                            <span>Imprimir</span>
                          </button>
                        </div>
                      </div>
                      <div className="cshift-history-stats">
                        <span>Base: <strong>{formatCurrency(h.initialCash || 0)}</strong></span>
                        <span>Ventas efectivo: <strong>{formatCurrency(h.sales?.cashTotal || 0)}</strong></span>
                        <span>Wompi QR: <strong>{formatCurrency(h.sales?.wompiTotal || 0)}</strong></span>
                        <span>Datáfono: <strong>{formatCurrency(h.sales?.cardTotal || 0)}</strong></span>
                        {(h.sales?.otherTotal || 0) > 0 && (
                          <span>Otros: <strong>{formatCurrency(h.sales.otherTotal)}</strong></span>
                        )}
                        <span>Total ventas: <strong className="cshift-text-accent">{formatCurrency(h.sales?.totalSales || 0)}</strong></span>
                        {h.closing && (
                          <span className={h.closing.difference >= 0 ? 'cshift-diff-pos' : 'cshift-diff-neg'}>
                            Diferencia: <strong>{formatCurrency(h.closing.difference)}</strong> ({h.closing.statusDifference})
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
            <div className="cshift-stack">
              {/* Tarjetas de Balance en Vivo */}
              <div className="cshift-stats-grid">
                <div className="cshift-stat">
                  <span className="cshift-stat-label">
                    <Lock size={12} /> Base inicial
                  </span>
                  <div className="cshift-stat-value">
                    {formatCurrency(currentShift.initialCash || 0)}
                  </div>
                </div>

                <div className="cshift-stat cshift-stat--emerald">
                  <span className="cshift-stat-label">
                    <DollarSign size={12} /> Efectivo cobrado
                  </span>
                  <div className="cshift-stat-value">
                    {formatCurrency(currentShift.sales?.cashTotal || 0)}
                  </div>
                </div>

                <div className="cshift-stat cshift-stat--blue">
                  <span className="cshift-stat-label">
                    <QrCode size={12} /> Wompi QR / Transf.
                  </span>
                  <div className="cshift-stat-value">
                    {formatCurrency(currentShift.sales?.wompiTotal || 0)}
                  </div>
                </div>

                <div className="cshift-stat cshift-stat--amber">
                  <span className="cshift-stat-label">
                    <CreditCard size={12} /> Datáfono / Tarjeta
                  </span>
                  <div className="cshift-stat-value">
                    {formatCurrency(currentShift.sales?.cardTotal || 0)}
                  </div>
                </div>

                {(currentShift.sales?.otherTotal || 0) > 0 && (
                  <div className="cshift-stat">
                    <span className="cshift-stat-label">Otros medios</span>
                    <div className="cshift-stat-value">
                      {formatCurrency(currentShift.sales.otherTotal)}
                    </div>
                  </div>
                )}

                <div className="cshift-stat cshift-stat--total">
                  <span className="cshift-stat-label">
                    <TrendingUp size={12} /> Total ventas ({currentShift.sales?.ordersCount || 0} ped.)
                  </span>
                  <div className="cshift-stat-value">
                    {formatCurrency(currentShift.sales?.totalSales || 0)}
                  </div>
                </div>
              </div>

              {/* Dinero Total Esperado en Gaveta Física */}
              <div className="cshift-expected">
                <div>
                  <span className="ui-label-xs cshift-expected-label">
                    Dinero físico esperado en gaveta
                  </span>
                  <p className="cshift-expected-formula">
                    Base inicial ({formatCurrency(currentShift.initialCash || 0)}) + Ventas efectivo ({formatCurrency(currentShift.sales?.cashTotal || 0)})
                  </p>
                </div>
                <div className="cshift-expected-value ui-tabular">
                  {formatCurrency(expectedCash)}
                </div>
              </div>

              {/* Botón Imprimir Arqueo en Vivo */}
              <div className="cshift-row-end">
                <button
                  type="button"
                  onClick={async () => {
                    sfx.playTap();
                    try {
                      await printCashShiftSlip(currentShift, false);
                      showAlert({ variant: 'info', title: 'Arqueo enviado', description: 'El reporte de arqueo actual se envió a la impresora térmica POS-58.' });
                    } catch (e) {
                      showAlert({ variant: 'error', title: 'No se pudo imprimir el arqueo', description: e.message });
                    }
                  }}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  <Printer size={16} />
                  <span>Imprimir arqueo en vivo (ticket parcial)</span>
                </button>
              </div>

              {/* Formulario de Cierre Z */}
              <form onSubmit={handleCloseShift} className="cshift-card cshift-form">
                <h4 className="cshift-form-title">
                  <Lock size={16} className="cshift-icon-danger" /> Realizar cierre de turno (Corte Z)
                </h4>

                <div className="cshift-fields-grid">
                  <div>
                    <label className="cshift-label" htmlFor="cshift-actual-cash">
                      Efectivo contado físicamente en caja
                    </label>
                    <input
                      id="cshift-actual-cash"
                      type="number"
                      required
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      className="cshift-input cshift-input--lg ui-tabular"
                    />
                  </div>

                  <div>
                    <span className="cshift-label">Balance / diferencia de caja</span>
                    <div className={`cshift-diff-box ${diffStatus}`}>
                      <span>{diffLabel}:</span>
                      <span className="ui-tabular">{formatCurrency(diff)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="cshift-label" htmlFor="cshift-close-notes">
                    Notas u observaciones de cierre (opcional)
                  </label>
                  <input
                    id="cshift-close-notes"
                    type="text"
                    placeholder="Ej. Billetes rotos, propinas entregadas, etc."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    className="cshift-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="ui-btn ui-btn-lg ui-btn-block cshift-btn-danger"
                >
                  <Lock size={18} />
                  <span>{submitting ? 'Procesando cierre Z...' : 'Confirmar cierre de turno y arqueo Z'}</span>
                </button>
              </form>
            </div>
          ) : (
            /* VISTA CAJA CERRADA (FORMULARIO DE APERTURA) */
            <div className="cshift-stack">
              <div className="cshift-notice">
                <AlertTriangle size={24} className="cshift-notice-icon" />
                <div>
                  <h4 className="cshift-notice-title">La caja se encuentra cerrada</h4>
                  <p className="cshift-notice-text">
                    Abre el turno indicando la base de efectivo inicial para habilitar el control de ventas del día.
                  </p>
                </div>
              </div>

              <form onSubmit={handleOpenShift} className="cshift-card cshift-form">
                <h3 className="cshift-form-title">Apertura de turno de caja</h3>

                <div>
                  <label className="cshift-label" htmlFor="cshift-open-cashier">
                    Cajero responsable
                  </label>
                  <select
                    id="cshift-open-cashier"
                    value={openCashierId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setOpenCashierId(id);
                      const emp = employees.find((x) => x.id === id);
                      if (emp) setOpenCashierName(emp.name);
                    }}
                    className="cshift-input"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} (ID: {emp.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="cshift-label" htmlFor="cshift-initial-cash">
                    Base de dinero inicial en gaveta (COP)
                  </label>
                  <input
                    id="cshift-initial-cash"
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={initialCash}
                    onChange={(e) => setInitialCash(e.target.value)}
                    placeholder="150000"
                    className="cshift-input cshift-input--lg ui-tabular"
                  />
                </div>

                <div>
                  <label className="cshift-label" htmlFor="cshift-open-notes">
                    Observaciones de apertura
                  </label>
                  <input
                    id="cshift-open-notes"
                    type="text"
                    value={openNotes}
                    onChange={(e) => setOpenNotes(e.target.value)}
                    placeholder="Base para cambio inicial"
                    className="cshift-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="ui-btn ui-btn-primary ui-btn-lg ui-btn-block"
                >
                  <Unlock size={18} />
                  <span>{submitting ? 'Iniciando turno...' : 'Abrir turno de caja'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
