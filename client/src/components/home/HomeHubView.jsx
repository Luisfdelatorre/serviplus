import React, { useState, useEffect } from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { fetchCurrentCashShift } from '../../api';
import { sfx } from '../../utils/audio';
import './HomeHub.css';

export function HomeHubView() {
  const setActiveTab = useMenuStore((state) => state.setActiveTab);
  const openLoginModal = useMenuStore((state) => state.openLoginModal);
  const openAdminLogin = useMenuStore((state) => state.openAdminLogin);
  const openAdminSettings = useMenuStore((state) => state.openAdminSettings);
  const openCashShiftModal = useMenuStore((state) => state.openCashShiftModal);
  const isCashShiftModalOpen = useMenuStore((state) => state.isCashShiftModalOpen);
  const sessionEmployee = useMenuStore((state) => state.sessionEmployee);
  const logoutEmployee = useMenuStore((state) => state.logoutEmployee);

  const [timeString, setTimeString] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [syncTimeAgo, setSyncTimeAgo] = useState('Hace un momento');
  const [cashShift, setCashShift] = useState({ isOpen: false, shift: null });

  // Cargar estado de turno de caja (Entrada / Salida)
  useEffect(() => {
    fetchCurrentCashShift()
      .then((res) => {
        if (res) setCashShift(res);
      })
      .catch(() => {});
  }, [isCashShiftModalOpen]);

  // Reloj de sistema dinámico en tiempo real (formato: "9:41 Lun 10 Jun")
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const rawDate = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      // Capitalizar primera letra: "Lun 10 Jun"
      const dateFormatted = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
      setTimeString(`${time} ${dateFormatted}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Telemetría de batería si la soporta el navegador del terminal
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Contador sutil de sincronización
  useEffect(() => {
    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 30;
      if (seconds < 60) {
        setSyncTimeAgo('Hace un momento');
      } else {
        const mins = Math.floor(seconds / 60);
        setSyncTimeAgo(`Hace ${mins} min`);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNav = (tabId) => {
    try { sfx.playTap(); } catch (_) {}
    setActiveTab(tabId);
  };

  const handleAdminClick = () => {
    try { sfx.playTap(); } catch (_) {}
    if (sessionEmployee && sessionEmployee.securityLevel <= 2) {
      openAdminSettings(sessionEmployee);
    } else {
      openAdminLogin();
    }
  };

  return (
    <div className="hub-container">
      {/* BEGIN: TopBar */}
      <header className="hub-topbar" data-purpose="topbar">
        {/* Reloj de sistema y estado de conexión superior */}
        <div className="hub-system-clock" data-purpose="system-clock">
          <span className="hub-live-clock" id="live-clock">{timeString || '9:41 Lun 10 Jun'}</span>
          <span className="hub-clock-dot"></span>
          <span className="hub-online-badge">
            <span className="hub-pulse-dot">
              <span className="pulse-ring"></span>
              <span className="pulse-core"></span>
            </span>
            En línea
          </span>
        </div>

        {/* Indicadores de hardware dispositivo (Batería y Wifi) */}
        <div className="hub-device-telemetry" data-purpose="device-telemetry">
          <div className="hub-telemetry-item" title="Señal Wi-Fi: Fuerte">
            {/* Icono Wi-Fi */}
            <svg className="hhub-s-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </div>
          <div className="hub-telemetry-item" title={`Batería ${batteryLevel}% Carga`}>
            <span>{batteryLevel}%</span>
            {/* Icono Batería */}
            <svg className="hhub-s-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" width="17" x="2" y="6"></rect>
              <path d="M21 10v4" strokeLinecap="round" strokeLinejoin="round"></path>
              <rect className="hhub-s-3" fill="currentColor" height="8" rx="1" stroke="none" width="13" x="4" y="8"></rect>
            </svg>
          </div>
        </div>
      </header>
      {/* END: TopBar */}

      {/* BEGIN: MainHeader */}
      {/* Barra corporativa y accesos rápidos de sesión/ajustes */}
      <div className="hub-mainheader" data-purpose="corporate-identity-bar">
        {/* Logotipo Corporativo UPAYSOLUTIONS S.A.S. */}
        <div className="hub-brand-group">
          <div className="hub-brand-logo">
            U
          </div>
          <div>
            <div className="hub-brand-name">
              UPAY<span>SOLUTIONS</span>
            </div>
            <p className="hub-brand-subtitle">S.A.S. • Smart Retail Tech</p>
          </div>
        </div>

        {/* Controles de sesión y accesos del sistema */}
        <div className="hub-header-actions">
          {/* Botón de Inicio/Cierre de Sesión */}
          {sessionEmployee ? (
            <button
              className="hub-action-btn logged-in"
              data-purpose="login-trigger"
              type="button"
              onClick={() => openLoginModal()}
              title="Sesión de empleado activa. Clic para cambiar de usuario."
            >
              <svg className="hhub-s-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{sessionEmployee.name || 'Cajero'}</span>
            </button>
          ) : (
            <button
              className="hub-action-btn"
              data-purpose="login-trigger"
              type="button"
              onClick={() => openLoginModal()}
            >
              <svg className="hhub-s-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Iniciar Sesión</span>
            </button>
          )}

          {/* Botón de Configuración rápida */}
          <button
            className="hub-action-btn"
            data-purpose="quick-settings-trigger"
            type="button"
            onClick={handleAdminClick}
          >
            <svg className="hhub-s-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
            <span>Configuración</span>
          </button>
        </div>
      </div>
      {/* END: MainHeader */}

      {/* BEGIN: MainContent */}
      <main className="hub-maincontent">
        {/* Banner de Estado de Caja y Acceso Directo a Entrada / Salida */}
        <div
          onClick={() => {
            try { sfx.playTap(); } catch (_) {}
            if (cashShift?.isOpen) {
              openCashShiftModal();
            } else {
              setActiveTab('cash-in');
            }
          }}
          className={`hhub-shift-banner ${cashShift?.isOpen ? 'is-open' : ''}`}
          title="Clic para gestionar Entrada de Cajero (Apertura) o Salida de Cajero (Cierre Z)"
        >
          <div className="hhub-s-6">
            <div className={`hhub-shift-icon-box ${cashShift?.isOpen ? 'is-open' : ''}`}>
              <svg className="hhub-s-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="hhub-s-8">
                <span className="hhub-s-9">
                  {cashShift?.isOpen
                    ? `Turno de Caja #${cashShift.shift.shiftNumber} Abierto`
                    : 'Caja Cerrada (Sin Turno Activo)'}
                </span>
                <span className={`hhub-shift-status-pill ${cashShift?.isOpen ? 'is-open' : ''}`}>
                  {cashShift?.isOpen ? 'EN SERVICIO' : 'INACTIVA'}
                </span>
              </div>
              <p className="hhub-s-10">
                {cashShift?.isOpen
                  ? `Responsable: ${cashShift.shift.cashierName} • Base Inicial: $${(cashShift.shift.initialCash || 0).toLocaleString()} • Clic para realizar Salida de Cajero o Arqueo Z`
                  : 'Haz clic aquí para realizar la Entrada de Cajero y registrar la base de efectivo inicial'}
              </p>
            </div>
          </div>

          <div className={`hhub-shift-cta-pill ${cashShift?.isOpen ? 'is-open' : ''}`}>
            <span>{cashShift?.isOpen ? 'Salida de Cajero (Cierre Z)' : 'Entrada de Cajero (Apertura)'}</span>
            <span className="hhub-s-11">→</span>
          </div>
        </div>

        {/* Rejilla 3x2 de módulos táctiles corporativos */}
        <div className="hub-navigation-grid" data-purpose="pos-navigation-grid">
          
          {/* Módulo 1: Punto de Venta (Point of Sale) */}
          <div
            className="hub-card"
            onClick={() => handleNav('cashier')}
            role="button"
            tabIndex={0}
          >
            <div className="hhub-s-12">
              <div className="hub-icon-container">
                {/* Icono Cubiertos / Servicio POS */}
                <svg className="hhub-s-13" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v16h2.5V2c-2.76 0-5 2.24-5 5v5h2.5V6z"></path>
                </svg>
              </div>
              <span className={`hhub-pos-card-pill ${cashShift?.isOpen ? 'is-open' : ''}`}>
                {cashShift?.isOpen ? 'Turno Activo' : 'Caja Cerrada'}
              </span>
            </div>
            <div className="hub-card-text">
              <span className="hub-card-title">Punto de Venta</span>
              <span className="hub-card-subtitle">Point of Sale</span>
            </div>
          </div>

          {/* Módulo 2: Pantalla de Entrega (Pick Up Display) */}
          <div
            className="hub-card"
            onClick={() => handleNav('turns')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-icon-container">
              {/* Icono Bolsa para llevar y bebida */}
              <svg className="hhub-s-13" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 5h-2V3a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v2H3a1 1 0 0 0-1 1v12a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V6a1 1 0 0 0-1-1zm-6-1h2v1H7V4z"></path>
                <path d="M19.5 7h-4a.5.5 0 0 0-.5.5v1.27l1.04 10.45A2 2 0 0 0 18.03 21h1.94a2 2 0 0 0 1.99-1.78l1.04-10.45V7.5a.5.5 0 0 0-.5-.5zM22.5 4.5l-3.2-1.6 1-2 1.8.9z"></path>
              </svg>
            </div>
            <div className="hub-card-text">
              <span className="hub-card-title">Pick Up Display</span>
              <span className="hub-card-subtitle">Pantalla de Entrega</span>
            </div>
          </div>

          {/* Módulo 3: Cocina / KDS (Kitchen Display System) */}
          <div
            className="hub-card"
            onClick={() => handleNav('kds')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-icon-container">
              {/* Icono Monitor de Cocina / KDS */}
              <svg className="hhub-s-13" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 3H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7v2H8v2h8v-2h-2v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H3V5h18v11z"></path>
              </svg>
            </div>
            <div className="hub-card-text">
              <span className="hub-card-title">KDS Cocina</span>
              <span className="hub-card-subtitle">Kitchen Display</span>
            </div>
          </div>

          {/* Módulo 4: Clientes / Kiosco (Customers & Loyalty / Autoservicio) */}
          <div
            className="hub-card"
            onClick={() => handleNav('kiosk')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-icon-container">
              {/* Icono Grupo de Clientes / Fidelización */}
              <svg className="hhub-s-13" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 3s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path>
              </svg>
            </div>
            <div className="hub-card-text">
              <span className="hub-card-title">Clientes / Kiosco</span>
              <span className="hub-card-subtitle">Customers &amp; Loyalty</span>
            </div>
          </div>

          {/* Módulo 5: Administración (Manage) */}
          <div
            className="hub-card"
            onClick={handleAdminClick}
            role="button"
            tabIndex={0}
          >
            <div className="hub-icon-container">
              {/* Icono Negocio / Empresa / Gestión de Sucursal */}
              <svg className="hhub-s-13" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path>
              </svg>
            </div>
            <div className="hub-card-text">
              <span className="hub-card-title">Administración</span>
              <span className="hub-card-subtitle">Backoffice &amp; Control</span>
            </div>
          </div>

          {/* Módulo 6: Configuración (Settings) */}
          <div
            className="hub-card"
            onClick={handleAdminClick}
            role="button"
            tabIndex={0}
          >
            <div className="hub-icon-container">
              {/* Icono Rueda Dentada / Hardware & Settings */}
              <svg className="hhub-s-13" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"></path>
              </svg>
            </div>
            <div className="hub-card-text">
              <span className="hub-card-title">Configuración</span>
              <span className="hub-card-subtitle">Hardware &amp; Preferencias</span>
            </div>
          </div>

        </div>
      </main>
      {/* END: MainContent */}

      {/* BEGIN: Footer */}
      {/* Barra de estado inferior profesional para terminal POS */}
      <footer className="hub-footer">
        {/* Información de Terminal y Empresa */}
        <div className="hub-terminal-info">
          <span className="hub-terminal-brand">UPAYSOLUTIONS S.A.S.</span>
          <span>•</span>
          <span>Terminal POS #01 - Sede Principal</span>
          <span>•</span>
          <span className="hub-terminal-ver">v2.4.1 (Stable Build)</span>
        </div>

        {/* Estado de sincronización en tiempo real */}
        <div className="hub-sync-status">
          <span className="hub-last-sync">
            <svg className="hhub-s-14" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" fillRule="evenodd"></path>
            </svg>
            <span>Última sincronización: <strong>{syncTimeAgo}</strong></span>
          </span>
          <div className="hub-divider"></div>
          <div className="hub-server-state">
            <span className="hub-sync-dot"></span>
            <span>Servidor Sincronizado</span>
          </div>
        </div>
      </footer>
      {/* END: Footer */}
    </div>
  );
}
export default HomeHubView;

