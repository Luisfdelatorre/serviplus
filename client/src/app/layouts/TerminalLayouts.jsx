import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { socket } from '../../socket';
import './TerminalLayouts.css';

/**
 * ErrorBoundary aislado por terminal para que un fallo en KDS o Admin
 * nunca deje en blanco la Caja o el Kiosco.
 */
export class TerminalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[TerminalErrorBoundary:${this.props.terminal || 'app'}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="terminal-error-boundary">
          <div className="terminal-error-card">
            <h2 className="terminal-error-title">Error en la terminal ({this.props.terminal || 'POS'})</h2>
            <p className="terminal-error-desc">
              {this.state.error?.message || 'Ocurrió un problema inesperado al renderizar esta vista.'}
            </p>
            <button type="button" className="terminal-error-btn" onClick={this.handleReset}>
              Reintentar vista
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function TerminalLoader({ label = 'Cargando módulo POS…' }) {
  return (
    <div className="terminal-loader">
      <div className="terminal-loader-spinner" />
      <span className="terminal-loader-text">{label}</span>
    </div>
  );
}

/**
 * Shell base de cada terminal: suscribe el socket a la room de la estación
 * (`kiosk`, `pos`, `kds`, `turns`, `admin`) y envuelve la vista en un ErrorBoundary.
 */
export function TerminalShell({ terminal, variantClass = '', children }) {
  useEffect(() => {
    if (terminal && socket && socket.connected) {
      socket.emit('terminal:join', terminal);
    }
  }, [terminal]);

  return (
    <TerminalErrorBoundary terminal={terminal}>
      <div className={`terminal-layout ${variantClass}`}>
        <div className="ios-status-bar-shield" aria-hidden="true" />
        {children || <Outlet />}
      </div>
    </TerminalErrorBoundary>
  );
}

export function KioskLayout({ children }) {
  return (
    <TerminalShell terminal="kiosk" variantClass="terminal-layout--kiosk">
      {children}
    </TerminalShell>
  );
}

export function PosLayout({ children }) {
  return (
    <TerminalShell terminal="pos" variantClass="terminal-layout--pos">
      {children}
    </TerminalShell>
  );
}

export function KdsLayout({ children }) {
  return (
    <TerminalShell terminal="kds" variantClass="terminal-layout--kds">
      {children}
    </TerminalShell>
  );
}

export function DisplayLayout({ children }) {
  return (
    <TerminalShell terminal="turns" variantClass="terminal-layout--display">
      {children}
    </TerminalShell>
  );
}

export function AdminLayout({ children }) {
  return (
    <TerminalShell terminal="admin" variantClass="terminal-layout--admin">
      {children}
    </TerminalShell>
  );
}

