import React, { useState, useEffect } from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { employeeLogin, adminLogin, fetchEmployees } from '../../api';
import { sfx } from '../../utils/audio';
import {
  Lock,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Delete,
  X,
  LogOut,
  ArrowRight
} from 'lucide-react';
import './UnifiedLoginModal.css';

/**
 * Componente Reutilizable Único para Autenticación Táctil con Numpad / PIN.
 * Soporta modo 'terminal' (acceso de cajeros y turnos) y modo 'admin' (acceso a configuración y gerencia).
 */
export function UnifiedLoginModal({
  isOpen,
  onClose,
  mode = 'terminal', // 'terminal' | 'admin'
  title,
  subtitle,
  icon,
  showEmployeeChips = true,
  showShiftActions,
  submitLabel,
  onSuccess
}) {
  const isAdmin = mode === 'admin';
  const defaultTitle = isAdmin ? 'Acceso Administrativo' : 'Acceso a Terminal POS';
  const defaultSubtitle = isAdmin ? 'Ingresa tu Código de Empleado / Gerente de Aldelo' : 'UPAYSOLUTIONS S.A.S.';
  const defaultSubmitLabel = isAdmin ? 'Acceder al Panel de Control' : 'Iniciar Turno / Entrar';
  const showShifts = showShiftActions !== undefined ? showShiftActions : !isAdmin;

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const sessionEmployee = useMenuStore((state) => state.sessionEmployee);
  const loginEmployee = useMenuStore((state) => state.loginEmployee);
  const logoutEmployee = useMenuStore((state) => state.logoutEmployee);
  const openCashShiftModal = useMenuStore((state) => state.openCashShiftModal);
  const setActiveTab = useMenuStore((state) => state.setActiveTab);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setSelectedEmp(null);
      fetchEmployees()
        .then((list) => {
          if (Array.isArray(list)) {
            // Si es modo admin, se pueden ordenar primero los gerentes/administradores (nivel <= 2)
            if (isAdmin) {
              const sorted = [...list].sort((a, b) => (a.securityLevel || 9) - (b.securityLevel || 9));
              setEmployeesList(sorted);
            } else {
              setEmployeesList(list);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    try { sfx.playTap(); } catch (_) {}
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    try { sfx.playTap(); } catch (_) {}
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    try { sfx.playTap(); } catch (_) {}
    setPin('');
    setError('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin || pin.length < 1) {
      setError('Ingresa tu código PIN o clave de acceso');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let result;
      if (isAdmin) {
        result = await adminLogin(pin);
      } else {
        result = await employeeLogin(pin);
      }

      try { sfx.playSuccess(); } catch (_) {}

      // Si es terminal, guardar sesión de empleado en el store
      if (!isAdmin) {
        loginEmployee(result.employee, result.token);
      }

      if (typeof onSuccess === 'function') {
        onSuccess(result.employee, result.token);
      }

      onClose();
    } catch (err) {
      try { sfx.playBeep(); } catch (_) {}
      setError(err.message || 'Código incorrecto o no autorizado');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = (emp) => {
    try { sfx.playTap(); } catch (_) {}
    setSelectedEmp(emp);
    setError('');
  };

  const handleLogout = () => {
    try { sfx.playTap(); } catch (_) {}
    logoutEmployee();
    onClose();
  };

  return (
    <div
      className="ulm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ulm-card">
        {/* Header Modal */}
        <div className="ulm-header">
          <div className="ulm-brand-box">
            <div className={`ulm-icon-badge ${isAdmin ? 'admin' : 'teal'}`}>
              {icon || (isAdmin ? <Shield size={24} /> : <Lock size={22} />)}
            </div>
            <div className="ulm-title-group">
              <h3>{title || defaultTitle}</h3>
              <p>{subtitle || defaultSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="ulm-close-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sesión Activa actual (solo si existe y estamos en modo terminal) */}
        {!isAdmin && sessionEmployee && (
          <div className="ulm-session-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} />
              <span>
                Sesión: <strong>{sessionEmployee.name || 'Cajero'}</strong> ({sessionEmployee.role || 'Cajero'})
              </span>
            </div>
            <button
              type="button"
              className="ulm-session-logout-btn"
              onClick={handleLogout}
            >
              <LogOut size={13} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}

        <div className="ulm-body">
          {/* Chips de selección rápida de empleado */}
          {showEmployeeChips && employeesList.length > 0 && !selectedEmp && (
            <div className="ulm-users-section">
              <span className="ulm-users-label">
                {isAdmin ? 'Selecciona tu usuario de gerencia:' : 'Selecciona tu usuario:'}
              </span>
              <div className="ulm-chips-scroll">
                {employeesList.slice(0, 6).map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className="ulm-user-chip"
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <span className="ulm-chip-avatar">
                      {(emp.firstName || emp.name || 'E').charAt(0).toUpperCase()}
                    </span>
                    <span>{emp.firstName || emp.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Badge de usuario seleccionado */}
          {selectedEmp && (
            <div className="ulm-selected-badge">
              <span>
                Usuario: <strong>{selectedEmp.firstName || selectedEmp.name}</strong>
                {selectedEmp.securityLevel !== undefined && (
                  <span style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: '6px' }}>
                    (Nivel: {selectedEmp.securityLevel})
                  </span>
                )}
              </span>
              <button type="button" onClick={() => setSelectedEmp(null)}>
                Cambiar
              </button>
            </div>
          )}

          {/* Caja con indicador de PIN */}
          <div className="ulm-pin-box">
            <div className="ulm-pin-dots">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => (
                <span
                  key={idx}
                  className={`ulm-pin-dot ${idx < pin.length ? 'filled' : ''}`}
                />
              ))}
            </div>
            {pin.length === 0 && (
              <span className="ulm-pin-hint">
                {isAdmin ? 'Ingresa tu PIN de autorización' : 'Ingresa tu PIN de 4 a 6 dígitos'}
              </span>
            )}
          </div>

          {/* Banner de Error */}
          {error && (
            <div className="ulm-error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Numpad Táctil */}
          <div className="ulm-numpad-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="ulm-num-btn"
                onClick={() => handleDigit(num.toString())}
                disabled={loading}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="ulm-num-btn fn"
              onClick={handleClear}
              disabled={loading}
            >
              C
            </button>
            <button
              type="button"
              className="ulm-num-btn"
              onClick={() => handleDigit('0')}
              disabled={loading}
            >
              0
            </button>
            <button
              type="button"
              className="ulm-num-btn fn"
              onClick={handleBackspace}
              disabled={loading}
            >
              <Delete size={20} />
            </button>
          </div>

          {/* Botón Principal */}
          <button
            type="button"
            className="ulm-submit-btn"
            onClick={handleSubmit}
            disabled={loading || pin.length < 1}
          >
            {loading ? (
              <span>Verificando con Aldelo POS...</span>
            ) : (
              <>
                {isAdmin ? <Lock size={18} /> : <CheckCircle2 size={18} />}
                <span>{submitLabel || defaultSubmitLabel}</span>
                {isAdmin && <ArrowRight size={18} />}
              </>
            )}
          </button>

          {/* Accesos directos a Entrada y Salida de Cajero */}
          {showShifts && (
            <div className="ulm-shift-actions">
              <button
                type="button"
                className="ulm-shift-btn in"
                onClick={() => {
                  onClose();
                  setActiveTab('cash-in');
                }}
                title="Apertura de Caja y Registro de Base Inicial"
              >
                <span>🟢 Entrada Cajero</span>
              </button>
              <button
                type="button"
                className="ulm-shift-btn out"
                onClick={() => {
                  onClose();
                  openCashShiftModal();
                }}
                title="Cierre de Caja y Balance / Arqueo Z"
              >
                <span>🔴 Salida Cajero (Z)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnifiedLoginModal;
