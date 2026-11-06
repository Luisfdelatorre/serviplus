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
import './KdsView.css';

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
        <button className="kds-menu-btn kds-menu-btn-clean" title="Menú">
          <Menu size={22} />
        </button>
        <div className="kds-clock-group">
          <Clock size={16} className="kds-clock-icon" />
          <span className="kds-clock" id="kds-live-clock">{clock}</span>
        </div>
        <span
          className="kds-topbar-res-pill kds-topbar-res-pill-styled"
          title="Resolución de pantalla / televisor"
        >
          <Tv size={13} className="kds-tv-icon" />
          <span>{screenRes}</span>
        </span>
      </div>

      {/* Center: Filter Capsule (Icons + Numbers only) */}
      <div className="kds-topbar-center">
        <div className="kds-filter-capsule">
          <button
            className={`kds-tab-pill kds-tab-pill-flex ${kdsFilter === 'PREP' ? 'active' : ''}`}
            onClick={() => setKdsFilter('PREP')}
            title="En Preparación"
          >
            <ChefHat size={18} />
            <span className="kds-tab-count">{prepCount}</span>
          </button>
          <button
            className={`kds-tab-pill kds-tab-pill-flex ${kdsFilter === 'READY' ? 'active' : ''}`}
            onClick={() => setKdsFilter('READY')}
            title="Listas para Entrega"
          >
            <CheckCheck size={18} />
            <span className="kds-tab-count">{readyCount}</span>
          </button>
        </div>
      </div>

      {/* Right: Icon-only Controls */}
      <div className="kds-topbar-right">
        <div className="kds-scale-pill-group" title="Tamaño de tarjetas de cocina (S, M, L)">
          <span className="kds-scale-icon kds-scale-icon-flex">
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

        <button
          type="button"
          className={`kds-icon-btn ${kdsAutoFit ? 'active-amber' : ''}`}
          onClick={toggleKdsAutoFit}
          title={kdsAutoFit ? 'Auto-Ajuste Dinámico: Activado' : 'Auto-Ajuste Dinámico: Desactivado'}
        >
          <Zap size={18} />
        </button>

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

        <button
          type="button"
          className={`kds-icon-btn ${isMirrorMode ? 'active-emerald' : ''}`}
          onClick={toggleMirrorMode}
          title={isMirrorMode ? 'Modo Espejo Activo: Sincronizado en vivo' : 'Modo Espejo Desactivado: Navegación independiente'}
        >
          <Cast size={18} />
        </button>

        <button
          type="button"
          className={`kds-icon-btn ${kdsTheme === 'dark' ? 'active-blue' : ''}`}
          onClick={toggleKdsTheme}
          title={kdsTheme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {kdsTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button
          type="button"
          className={`kds-icon-btn ${isFullscreen ? 'active-red' : ''}`}
          onClick={handleFullscreenToggle}
          title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa Cocina'}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        <button
          type="button"
          className={`kds-icon-btn ${isReloading ? 'active-amber' : ''}`}
          onClick={handleHardReload}
          title="Recarga Forzada (Hard Reload) • Actualizar base de datos y productos sin caché"
        >
          <RotateCw size={17} className={`kds-rotate-icon ${isReloading ? 'reloading' : ''}`} />
        </button>
      </div>
    </div>
  );
}
