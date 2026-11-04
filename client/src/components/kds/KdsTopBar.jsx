import React, { useState, useEffect } from 'react';
import {
  Menu,
  Clock,
  Tv,
  ChefHat,
  CheckCheck,
  SlidersHorizontal,
  Zap,
  Cast,
  Sun,
  Moon,
  Maximize,
  Minimize,
  RotateCw
} from 'lucide-react';
import { useKdsStore } from '../../store/useKdsStore';
import { useMenuStore } from '../../store/useMenuStore';
import { formatRegularTime } from '../../utils/format';
import { enterFullscreen, exitFullscreen } from '../../utils/fullscreen';
import { sfx } from '../../utils/audio';

export function KdsTopBar({ prepCount, readyCount, totalPages }) {
  const [clock, setClock] = useState(formatRegularTime(new Date()));
  const [isReloading, setIsReloading] = useState(false);
  const kdsFilter = useKdsStore((state) => state.kdsFilter);
  const setKdsFilter = useKdsStore((state) => state.setKdsFilter);
  const kdsPage = useKdsStore((state) => state.kdsPage);
  const setKdsPage = useKdsStore((state) => state.setKdsPage);
  const kdsScale = useKdsStore((state) => state.kdsScale);
  const setKdsScale = useKdsStore((state) => state.setKdsScale);
  const kdsAutoFit = useKdsStore((state) => state.kdsAutoFit);
  const toggleKdsAutoFit = useKdsStore((state) => state.toggleKdsAutoFit);
  const isMirrorMode = useKdsStore((state) => state.isMirrorMode);
  const toggleMirrorMode = useKdsStore((state) => state.toggleMirrorMode);
  const kdsTheme = useKdsStore((state) => state.kdsTheme);
  const toggleKdsTheme = useKdsStore((state) => state.toggleKdsTheme);
  const isFullscreen = useMenuStore((state) => state.isFullscreen);
  const setFullscreen = useMenuStore((state) => state.setFullscreen);

  const [screenRes, setScreenRes] = useState(() => `${window.screen?.width || window.innerWidth}×${window.screen?.height || window.innerHeight}`);

  useEffect(() => {
    const handleResize = () => {
      setScreenRes(`${window.screen?.width || window.innerWidth}×${window.screen?.height || window.innerHeight}`);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatRegularTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFullscreenToggle = () => {
    if (isFullscreen) {
      exitFullscreen();
      setFullscreen(false);
    } else {
      enterFullscreen();
      setFullscreen(true);
    }
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
    <div className="kds-topbar">
      {/* Left: Menu & Clock & Resolution */}
      <div className="kds-topbar-left">
        <button
          className="kds-menu-btn"
          title="Menú"
          style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
        >
          <Menu size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} style={{ color: '#94a3b8' }} />
          <span className="kds-clock" id="kds-live-clock">{clock}</span>
        </div>
        <span
          className="kds-topbar-res-pill"
          title="Resolución de pantalla / televisor"
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '3px 8px',
            borderRadius: '999px',
            fontFamily: 'monospace',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginLeft: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Tv size={13} style={{ color: '#38bdf8' }} />
          <span>{screenRes}</span>
        </span>
      </div>

      {/* Center: Filter Capsule (Icons + Numbers only) */}
      <div className="kds-topbar-center">
        <div className="kds-filter-capsule">
          <button
            className={`kds-tab-pill ${kdsFilter === 'PREP' ? 'active' : ''}`}
            onClick={() => setKdsFilter('PREP')}
            title="En Preparación"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
          >
            <ChefHat size={18} />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{prepCount}</span>
          </button>
          <button
            className={`kds-tab-pill ${kdsFilter === 'READY' ? 'active' : ''}`}
            onClick={() => setKdsFilter('READY')}
            title="Listas para Entrega"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
          >
            <CheckCheck size={18} />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{readyCount}</span>
          </button>
        </div>
      </div>

      {/* Right: Icon-only Controls */}
      <div className="kds-topbar-right">
        {/* Scale Pills */}
        <div className="kds-scale-pill-group" title="Tamaño de tarjetas de cocina (S, M, L)">
          <span className="kds-scale-icon" style={{ display: 'flex', alignItems: 'center' }}>
            <SlidersHorizontal size={14} />
          </span>
          <button
            type="button"
            className={`kds-scale-pill ${kdsScale === 'compact' ? 'active' : ''}`}
            onClick={() => setKdsScale('compact')}
            title="Compacto (5 columnas)"
          >
            S
          </button>
          <button
            type="button"
            className={`kds-scale-pill ${kdsScale === 'normal' ? 'active' : ''}`}
            onClick={() => setKdsScale('normal')}
            title="Normal (4 columnas)"
          >
            M
          </button>
          <button
            type="button"
            className={`kds-scale-pill ${kdsScale === 'large' ? 'active' : ''}`}
            onClick={() => setKdsScale('large')}
            title="Grande (3 columnas / 4 columnas en TV 2K)"
          >
            L
          </button>
        </div>

        {/* Auto-Ajuste Button (Zap Icon Only) */}
        <button
          type="button"
          className={`kds-icon-btn ${kdsAutoFit ? 'active-amber' : ''}`}
          onClick={toggleKdsAutoFit}
          title={kdsAutoFit ? 'Auto-Ajuste Dinámico: Activado' : 'Auto-Ajuste Dinámico: Desactivado'}
        >
          <Zap size={18} />
        </button>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="kds-pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`kds-page-btn ${p === kdsPage ? 'active' : ''}`}
                onClick={() => setKdsPage(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Mirror Mode (Cast Icon Only) */}
        <button
          type="button"
          className={`kds-icon-btn ${isMirrorMode ? 'active-emerald' : ''}`}
          onClick={toggleMirrorMode}
          title={isMirrorMode ? 'Modo Espejo Activo: Sincronizado en vivo' : 'Modo Espejo Desactivado: Navegación independiente'}
        >
          <Cast size={18} />
        </button>

        {/* Dark / Light Mode Toggle (Moon / Sun Icon Only) */}
        <button
          type="button"
          className={`kds-icon-btn ${kdsTheme === 'dark' ? 'active-blue' : ''}`}
          onClick={toggleKdsTheme}
          title={kdsTheme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {kdsTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Fullscreen Button (Maximize / Minimize Icon Only) */}
        <button
          type="button"
          className={`kds-icon-btn ${isFullscreen ? 'active-red' : ''}`}
          onClick={handleFullscreenToggle}
          title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa Cocina'}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        {/* Hard Reload Button (Recarga Forzada Limpiando Caché) */}
        <button
          type="button"
          className={`kds-icon-btn ${isReloading ? 'active-amber' : ''}`}
          onClick={handleHardReload}
          title="Recarga Forzada (Hard Reload) • Actualizar base de datos y productos sin caché"
        >
          <RotateCw size={17} style={{ animation: isReloading ? 'spin 0.75s linear infinite' : 'none' }} />
        </button>
      </div>
    </div>
  );
}
