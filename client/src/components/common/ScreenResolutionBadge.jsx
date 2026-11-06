import React, { useState, useEffect } from 'react';
import './CommonComponents.css';

/**
 * ScreenResolutionBadge
 * Muestra en una esquinita de la pantalla la resolución activa del televisor / monitor.
 * Se actualiza automáticamente al redimensionar la ventana o al entrar/salir de pantalla completa.
 */
export function ScreenResolutionBadge({ position = 'bottom-right' }) {
  const [res, setRes] = useState(() => ({
    screenW: window.screen?.width || window.innerWidth,
    screenH: window.screen?.height || window.innerHeight,
    windowW: window.innerWidth,
    windowH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    isFs: !!document.fullscreenElement
  }));

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const update = () => {
      setRes({
        screenW: window.screen?.width || window.innerWidth,
        screenH: window.screen?.height || window.innerHeight,
        windowW: window.innerWidth,
        windowH: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        isFs: !!document.fullscreenElement
      });
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', update);
    };
  }, []);

  const physicalW = Math.round(res.screenW * (res.dpr || 1));
  const physicalH = Math.round(res.screenH * (res.dpr || 1));

  const posClass = ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(position)
    ? `pos-${position}`
    : 'pos-bottom-right';

  return (
    <div
      className={`kds-resolution-badge srb-badge ${posClass} ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded((prev) => !prev)}
      title="Resolución de Pantalla del Televisor (clic para más detalles)"
    >
      <div className="srb-summary-row">
        <span className="srb-tv-icon">📺</span>
        <span className="srb-res-main">
          {res.screenW} × {res.screenH}
        </span>
        {!expanded && (res.windowW !== res.screenW || res.windowH !== res.screenH) && (
          <span className="srb-res-window">
            ({res.windowW}×{res.windowH})
          </span>
        )}
        <span className="srb-chevron">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div className="srb-details">
          <div><strong>Pantalla:</strong> {res.screenW} × {res.screenH}</div>
          <div><strong>Ventana:</strong> {res.windowW} × {res.windowH}</div>
          <div><strong>Física/Panel:</strong> {physicalW} × {physicalH} ({res.dpr}x)</div>
          <div><strong>Modo:</strong> {res.isFs ? '🟢 Pantalla Completa' : '⚪ Modo Ventana'}</div>
          {res.dpr > 1 && (
            <div className="srb-hint-scale">
              💡 <strong>Escala al {Math.round(res.dpr * 100)}% ({res.dpr}x):</strong><br />
              Presiona <code>Ctrl + 0</code> o ajusta la escala de pantalla al <strong>100%</strong> en Windows/Navegador para desbloquear los <strong>1920 × 1080</strong> completos.
            </div>
          )}
          {!res.isFs && (
            <div className="srb-hint-fs">
              ⛶ Presiona <strong>F11</strong> para pantalla completa.
            </div>
          )}
          <div className="srb-collapse-note">
            (Clic para compactar)
          </div>
        </div>
      )}
    </div>
  );
}
