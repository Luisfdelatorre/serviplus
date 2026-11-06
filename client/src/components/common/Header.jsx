import React, { useState, useEffect } from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { useI18n } from '../../i18n';
import { sfx } from '../../utils/audio';
import { subscribeOutbox, flushOrderOutbox } from '../../shared/offline/orderOutbox';
import { Shield, RotateCw } from 'lucide-react';
import './CommonComponents.css';

export function Header() {
  const [isReloading, setIsReloading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [outboxCount, setOutboxCount] = useState(0);
  const activeTab = useMenuStore((state) => state.activeTab);
  const setActiveTab = useMenuStore((state) => state.setActiveTab);
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
      {/* Brand Serviplus */}
      <div className="hdr-brand">
        <span className="hdr-brand-title">Serviplus</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="hdr-nav">
        {[
          { id: 'home', label: '🏠 Inicio' },
          { id: 'cashier', label: 'Caja' },
          { id: 'kds', label: 'KDS' },
          { id: 'kiosk', label: 'Kiosk' }
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
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
            openAdminLogin();
          }}
          title="Panel de Administración (Acceso Gerencial Aldelo)"
          className="hdr-admin-btn"
        >
          <Shield size={15} color="#da291c" />
          <span>Admin</span>
        </button>

        {/* Status Dot & Offline Outbox Badge */}
        <div className={`hdr-status ${isOnline ? 'online' : 'offline'}`}>
          <span className={`hdr-status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
          {outboxCount > 0 && (
            <button
              type="button"
              onClick={() => flushOrderOutbox()}
              className="hdr-outbox-badge"
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
