import React, { useState, useEffect } from 'react';

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

  // Determinar posicionamiento según prop
  const positionStyles = {
    'bottom-right': { bottom: '10px', right: '14px' },
    'bottom-left': { bottom: '10px', left: '14px' },
    'top-right': { top: '10px', right: '14px' },
    'top-left': { top: '10px', left: '14px' }
  }[position] || { bottom: '10px', right: '14px' };

  return (
    <div
      className="kds-resolution-badge"
      onClick={() => setExpanded((prev) => !prev)}
      title="Resolución de Pantalla del Televisor (clic para más detalles)"
      style={{
        position: 'fixed',
        ...positionStyles,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '8px',
        padding: expanded ? '8px 12px' : '4px 9px',
        color: '#94a3b8',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '11px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        lineHeight: 1.3
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: '#38bdf8' }}>📺</span>
        <span style={{ color: '#f8fafc', fontWeight: 700, letterSpacing: '0.3px' }}>
          {res.screenW} × {res.screenH}
        </span>
        {!expanded && (res.windowW !== res.screenW || res.windowH !== res.screenH) && (
          <span style={{ color: '#64748b', fontSize: '10px' }}>
            ({res.windowW}×{res.windowH})
          </span>
        )}
        <span style={{ color: '#475569', fontSize: '9px', marginLeft: '2px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px', fontSize: '10px', color: '#cbd5e1' }}>
          <div><strong>Pantalla:</strong> {res.screenW} × {res.screenH}</div>
          <div><strong>Ventana:</strong> {res.windowW} × {res.windowH}</div>
          <div><strong>Física/Panel:</strong> {physicalW} × {physicalH} ({res.dpr}x)</div>
          <div><strong>Modo:</strong> {res.isFs ? '🟢 Pantalla Completa' : '⚪ Modo Ventana'}</div>
          {res.dpr > 1 && (
            <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '6px', color: '#fde047', lineHeight: 1.3 }}>
              💡 <strong>Escala al {Math.round(res.dpr * 100)}% ({res.dpr}x):</strong><br />
              Presiona <code>Ctrl + 0</code> o ajusta la escala de pantalla al <strong>100%</strong> en Windows/Navegador para desbloquear los <strong>1920 × 1080</strong> completos.
            </div>
          )}
          {!res.isFs && (
            <div style={{ marginTop: '4px', padding: '4px 6px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#7dd3fc', lineHeight: 1.3 }}>
              ⛶ Presiona <strong>F11</strong> para pantalla completa.
            </div>
          )}
          <div style={{ color: '#64748b', marginTop: '6px', fontSize: '9px' }}>
            (Clic para compactar)
          </div>
        </div>
      )}
    </div>
  );
}

