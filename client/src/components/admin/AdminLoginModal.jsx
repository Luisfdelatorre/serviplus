import React, { useState } from 'react';
import { adminLogin } from '../../api';
import { sfx } from '../../utils/audio';
import { Shield, Lock, X, AlertCircle, ArrowRight, Delete } from 'lucide-react';

export function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    sfx.playTap();
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    sfx.playTap();
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    sfx.playTap();
    setPin('');
    setError('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin || pin.length < 1) {
      setError('Ingresa el código de acceso de Aldelo');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await adminLogin(pin);
      sfx.playSuccess();
      setPin('');
      onSuccess(data.employee, data.token);
    } catch (err) {
      sfx.playBeep();
      setError(err.message || 'Código incorrecto o sin privilegios de administrador');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-login-card">
        {/* Header */}
        <div className="admin-login-header">
          <div className="admin-shield-icon">
            <Shield size={28} />
          </div>
          <div>
            <h3>Acceso Administrativo</h3>
            <p>Ingresa tu Código de Empleado / Gerente de Aldelo</p>
          </div>
          <button className="admin-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* PIN Display */}
        <div className="admin-pin-display">
          <div className="admin-pin-dots">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => (
              <span
                key={idx}
                className={`admin-pin-dot ${idx < pin.length ? 'filled' : ''}`}
              />
            ))}
          </div>
          {pin.length === 0 && <span className="admin-pin-placeholder">Teclea tu código PIN</span>}
        </div>

        {error && (
          <div className="admin-error-badge">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Numpad Táctil */}
        <div className="admin-numpad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              className="admin-num-btn"
              onClick={() => handleDigit(num.toString())}
              disabled={loading}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="admin-num-btn clear-btn"
            onClick={handleClear}
            disabled={loading}
          >
            C
          </button>
          <button
            type="button"
            className="admin-num-btn"
            onClick={() => handleDigit('0')}
            disabled={loading}
          >
            0
          </button>
          <button
            type="button"
            className="admin-num-btn back-btn"
            onClick={handleBackspace}
            disabled={loading}
          >
            <Delete size={22} />
          </button>
        </div>

        {/* Botón Entrar */}
        <button
          type="button"
          className="admin-submit-btn"
          onClick={handleSubmit}
          disabled={loading || pin.length === 0}
        >
          {loading ? (
            <span>Verificando con Aldelo POS...</span>
          ) : (
            <>
              <Lock size={18} />
              <span>Acceder al Panel de Control</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
