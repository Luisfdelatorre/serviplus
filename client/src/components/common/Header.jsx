import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMenuStore } from '../../store/useMenuStore';
import { useI18n } from '../../i18n';
import { sfx } from '../../utils/audio';
import { subscribeOutbox, flushOrderOutbox } from '../../shared/offline/orderOutbox';
import { Shield, RotateCw } from 'lucide-react';
import { UpayLogo } from './UpayLogo';
import './CommonComponents.css';

export function Header() {
  const [isReloading, setIsReloading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [outboxCount, setOutboxCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const openAdminLogin = useMenuStore((state) => state.openAdminLogin);
  const { lang, setLang } = useI18n();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOrderOutbox().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribe = subscribeOutbox((count) => setOutboxCount(count));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleTabChange = (tab) => {
    sfx.playTap();
    setActiveTab(tab);
  };

  const handleHardReload = () => {
    try { sfx.playTap(); } catch (_) {}
    setIsReloading(true);
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      }).catch(() => {});
    }
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_hreload', Date.now().toString());
      window.location.replace(url.toString());
    }, 120);
  };

  return (
    <header className="main-header hdr-bar">
      {/* Brand Serviplus / UPAY */}
      <div className="hdr-brand">
        <UpayLogo size={26} className="hdr-brand-logo-icon" />
        <span className="hdr-brand-title">Serviplus</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="hdr-nav">
        {[
          { path: '/', label: '🏠 Inicio', match: (p) => p === '/' },
          { path: '/front', label: 'Caja', match: (p) => p.startsWith('/front') },
          { path: '/kds', label: 'KDS', match: (p) => p.startsWith('/kds') },
          { path: '/kiosk', label: 'Kiosk', match: (p) => p.startsWith('/kiosk') }
        ].map((t) => {
          const isActive = t.match(location.pathname);
          return (
            <button
              key={t.path}
              type="button"
              onClick={() => {
                sfx.playTap();
                navigate(t.path);
              }}
              className={`hdr-tab-btn ${isActive ? 'active' : ''}`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Language Switch & Status */}
      <div className="hdr-actions">
        {/* Toggle Idioma Segmentado */}
        <div className="hdr-lang-switch">
          <button
            type="button"
            onClick={() => { sfx.playTap(); setLang('es'); }}
            className={`hdr-lang-btn ${lang === 'es' ? 'active' : ''}`}
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => { sfx.playTap(); setLang('en'); }}
            className={`hdr-lang-btn ${lang === 'en' ? 'active' : ''}`}
          >
            EN
          </button>
        </div>

        {/* Botón Hard Reload */}
        <button
          type="button"
          onClick={handleHardReload}
          title="Recarga Forzada (Hard Reload) • Limpiar caché y recargar"
          className="hdr-reload-btn"
        >
          <RotateCw size={14} className={`hdr-reload-icon ${isReloading ? 'reloading' : ''}`} />
        </button>

        {/* Botón Admin Aldelo */}
        <button
          type="button"
          onClick={() => {
            sfx.playTap();
            navigate('/admin');
          }}
          title="Panel de Administración (Acceso Gerencial Aldelo)"
          className="hdr-admin-btn"
        >
          <Shield size={15} color="#da291c" />
          <span>Admin</span>
        </button>

        {/* Status Dot & Offline Outbox Badge */}
        <div className={`hdr-status ${isOnline ? 'online' : 'offline'}`}>
          <span className={`ui-dot lg ${isOnline ? 'online' : 'offline'}`} />
          <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
          {outboxCount > 0 && (
            <button
              type="button"
              onClick={() => flushOrderOutbox()}
              className="ui-pill ui-pill-xs ui-pill-gold ui-pill-interactive"
              title="Órdenes en cola offline pendientes de sincronizar (clic para reintentar)"
            >
              ⏳ {outboxCount}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
