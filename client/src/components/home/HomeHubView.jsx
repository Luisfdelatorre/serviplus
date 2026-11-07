import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wifi,
  Battery,
  BatteryCharging,
  User,
  Settings,
  BadgeDollarSign,
  ArrowRight,
  Utensils,
  ShoppingBag,
  Monitor,
  Users,
  Globe,
  SlidersHorizontal,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useMenuStore } from '../../store/useMenuStore';
import { fetchCurrentCashShift } from '../../api';
import { sfx } from '../../utils/audio';
import { CashShiftModal } from '../cashier/CashShiftModal';
import { UnifiedLoginModal } from '../auth/UnifiedLoginModal';
import { UpayLogo } from '../common/UpayLogo';
import './HomeHub.css';

export function HomeHubView() {
  const navigate = useNavigate();

  // Store de sesión y modales
  const openLoginModal = useMenuStore((state) => state.openLoginModal);
  const closeLoginModal = useMenuStore((state) => state.closeLoginModal);
  const isLoginModalOpen = useMenuStore((state) => state.isLoginModalOpen);
  const openCashShiftModal = useMenuStore((state) => state.openCashShiftModal);
  const closeCashShiftModal = useMenuStore((state) => state.closeCashShiftModal);
  const isCashShiftModalOpen = useMenuStore((state) => state.isCashShiftModalOpen);
  const sessionEmployee = useMenuStore((state) => state.sessionEmployee);

  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
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

  // Reloj nativo estilo iOS (Hora 24h y Fecha corta en español)
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
      const rawDate = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      const capitalizedDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

      setTimeString(time);
      setDateString(capitalizedDate);
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 5000);
    return () => clearInterval(timer);
  }, []);

  // Telemetría de batería si la soporta el navegador o tablet
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(Boolean(battery.charging));

        const updateBattery = () => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(Boolean(battery.charging));
        };

        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch(() => {});
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Contador de sincronización
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
    const routeMap = {
      home: '/',
      kiosk: '/kiosk',
      cashier: '/front',
      pos: '/front',
      front: '/front',
      'cash-in': '/front/cash-in',
      apertura: '/front/cash-in',
      kds: '/kds',
      turns: '/display',
      display: '/display',
      admin: '/admin'
    };
    navigate(routeMap[tabId] || `/${tabId}`);
  };

  const handleAdminClick = () => {
    try { sfx.playTap(); } catch (_) {}
    navigate('/admin');
  };

  const isShiftOpen = Boolean(cashShift?.isOpen && cashShift?.shift);
  const currentShift = cashShift?.shift;

  return (
    <div className="hub-container">
      {/* TOP APP SHELL (Navigation Bar) */}
      <header className="hub-app-shell">
        {/* Main Navigation Bar */}
        <div className="hub-mainheader">
          {/* Brand & Solution Logo */}
          <div className="hub-brand-group">
            <div className="hub-brand-logo">
              <UpayLogo size={32} className="hub-brand-svg" />
            </div>
            <div>
              <div className="hub-brand-name">
                <span>UPAY</span>
                <span className="upay-accent">SOLUTIONS</span>
              </div>
              <p className="hub-brand-subtitle">
                S.A.S. • SMART RETAIL TECH
              </p>
            </div>
            <span className={`ui-pill ui-pill-xs ui-pill-emerald ${isOnline ? 'online' : 'offline'}`}>
              <span className="ui-dot-ping">
                <span className="pulse-ring"></span>
                <span className="pulse-core"></span>
              </span>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </span>
          </div>

          {/* Quick Action Controls */}
          <div className="hub-header-actions">
            {/* User Profile Pill */}
            <button
              type="button"
              onClick={() => {
                try { sfx.playTap(); } catch (_) {}
                openLoginModal();
              }}
              className="ui-btn ui-btn-tonal ui-btn-sm hub-profile-btn"
              title={sessionEmployee ? 'Sesión iniciada. Clic para cambiar de cajero.' : 'Clic para iniciar sesión de cajero'}
            >
              <User size={15} className="hub-profile-icon" />
              <span>{sessionEmployee?.name || 'Iniciar Sesión'}</span>
            </button>

            {/* Settings Button */}
            <button
              type="button"
              onClick={handleAdminClick}
              className="ui-btn ui-btn-secondary ui-btn-sm hub-settings-btn"
              title="Panel de Ajustes y Hardware"
            >
              <Settings size={15} className="hub-settings-icon" />
              <span>Configuración</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT CONTENT */}
      <main className="hub-maincontent">
        {/* BANNER: Shift Status & Cash Register (iOS Inset Banner) */}
        <section aria-label="Turno de Caja">
          <div
            role="region"
            aria-label="Estado de turno de caja"
            className="hhub-shift-banner"
            onClick={() => {
              try { sfx.playTap(); } catch (_) {}
              if (isShiftOpen) {
                openCashShiftModal();
              } else {
                navigate('/front/cash-in');
              }
            }}
            title="Clic para gestionar Entrada de Cajero o Salida de Cajero (Cierre Z)"
          >
            <div className="hhub-shift-content">
              {/* Icon avatar container */}
              <div className={`hhub-shift-icon-box ${isShiftOpen ? 'is-open' : ''}`}>
                <BadgeDollarSign size={24} />
              </div>

              <div className="hhub-shift-text-group">
                <div className="hhub-shift-title-row">
                  <h2>
                    {isShiftOpen
                      ? `Turno de Caja #${currentShift?.shiftNumber || ''} Abierto`
                      : 'Caja Cerrada (Sin Turno Activo)'}
                  </h2>
                  <span className={`ui-pill ui-pill-sm ui-pill-neutral ui-pill-upper ${isShiftOpen ? 'is-open' : ''}`}>
                    {isShiftOpen ? 'EN SERVICIO' : 'INACTIVA'}
                  </span>
                </div>
                <p className="hhub-shift-desc">
                  {isShiftOpen ? (
                    <>
                      Responsable: <strong>{currentShift?.cashierName || sessionEmployee?.name || 'Cajero'}</strong> • Base Inicial: <strong>${(currentShift?.initialCash || 0).toLocaleString()}</strong> • Clic para realizar Salida de Cajero o Arqueo Z
                    </>
                  ) : (
                    'Haz clic aquí para realizar la Entrada de Cajero y registrar la base de efectivo inicial'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="ui-btn ui-btn-primary ui-btn-md hhub-shift-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                try { sfx.playTap(); } catch (_) {}
                if (isShiftOpen) {
                  openCashShiftModal();
                } else {
                  navigate('/front/cash-in');
                }
              }}
            >
              <span>{isShiftOpen ? 'Salida de Cajero (Cierre Z)' : 'Entrada de Cajero (Apertura)'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>

        {/* GRID: Operational Module Cards (3x2 Responsive Layout) */}
        <section aria-label="Módulos del Sistema" className="hub-navigation-grid">
          {/* Card 1: Punto de Venta (POS) */}
          <div
            className="hub-card"
            onClick={() => handleNav('front')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-card-header">
              <div className={`hub-card-icon-box ${isShiftOpen ? 'active-accent' : ''}`}>
                <Utensils size={26} />
              </div>
              <span className={`ui-pill ui-pill-sm ui-pill-neutral ${isShiftOpen ? 'is-open' : 'closed'}`}>
                {isShiftOpen ? 'Turno Activo' : 'Caja Cerrada'}
              </span>
            </div>
            <div className="hub-card-body">
              <h3 className="hub-card-title">Punto de Venta</h3>
              <p className="hub-card-subtitle">Point of Sale</p>
            </div>
          </div>

          {/* Card 2: Pick Up Display */}
          <div
            className="hub-card"
            onClick={() => handleNav('display')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-card-header">
              <div className="hub-card-icon-box">
                <ShoppingBag size={26} />
              </div>
            </div>
            <div className="hub-card-body">
              <h3 className="hub-card-title">Pick Up Display</h3>
              <p className="hub-card-subtitle">Pantalla de Entrega</p>
            </div>
          </div>

          {/* Card 3: KDS Cocina */}
          <div
            className="hub-card"
            onClick={() => handleNav('kds')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-card-header">
              <div className="hub-card-icon-box">
                <Monitor size={26} />
              </div>
            </div>
            <div className="hub-card-body">
              <h3 className="hub-card-title">KDS Cocina</h3>
              <p className="hub-card-subtitle">Kitchen Display</p>
            </div>
          </div>

          {/* Card 4: Clientes / Kiosco */}
          <div
            className="hub-card"
            onClick={() => handleNav('kiosk')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-card-header">
              <div className="hub-card-icon-box">
                <Users size={26} />
              </div>
            </div>
            <div className="hub-card-body">
              <h3 className="hub-card-title">Clientes / Kiosco</h3>
              <p className="hub-card-subtitle">Customers &amp; Loyalty</p>
            </div>
          </div>

          {/* Card 5: Administración */}
          <div
            className="hub-card"
            onClick={handleAdminClick}
            role="button"
            tabIndex={0}
          >
            <div className="hub-card-header">
              <div className="hub-card-icon-box">
                <Globe size={26} />
              </div>
            </div>
            <div className="hub-card-body">
              <h3 className="hub-card-title">Administración</h3>
              <p className="hub-card-subtitle">Backoffice &amp; Control</p>
            </div>
          </div>

          {/* Card 6: Configuración */}
          <div
            className="hub-card"
            onClick={handleAdminClick}
            role="button"
            tabIndex={0}
          >
            <div className="hub-card-header">
              <div className="hub-card-icon-box">
                <SlidersHorizontal size={26} />
              </div>
            </div>
            <div className="hub-card-body">
              <h3 className="hub-card-title">Configuración</h3>
              <p className="hub-card-subtitle">Hardware &amp; Preferencias</p>
            </div>
          </div>
        </section>
      </main>

      {/* BOTTOM FOOTER & SYSTEM BAR (iOS Home Bar Style Dock) */}
      <footer className="hub-footer">
        <div className="hub-footer-inner">
          <div className="hub-footer-left">
            <span className="hub-footer-brand">UPAYSOLUTIONS S.A.S.</span>
            <span>•</span>
            <span>Terminal POS #01 - Sede Principal</span>
            <span>•</span>
            <span className="ui-pill ui-pill-xs ui-pill-neutral">v2.4.1 (Stable Build)</span>
          </div>

          <div className="hub-footer-right">
            <div className="hub-footer-item">
              <Clock size={14} className="hub-footer-icon" />
              <span>Última sincronización: <strong>{syncTimeAgo}</strong></span>
            </div>
            <span className="hub-footer-divider">|</span>
            <div className="hub-footer-item">
              <CheckCircle2 size={14} className="hub-footer-icon" />
              <strong>Servidor Sincronizado</strong>
            </div>
          </div>
        </div>
      </footer>

      {/* Modales de Turno y Login */}
      {isCashShiftModalOpen && (
        <CashShiftModal
          isOpen={isCashShiftModalOpen}
          onClose={closeCashShiftModal}
        />
      )}

      {isLoginModalOpen && (
        <UnifiedLoginModal
          isOpen={isLoginModalOpen}
          mode="terminal"
          onClose={closeLoginModal}
        />
      )}
    </div>
  );
}

export default HomeHubView;
