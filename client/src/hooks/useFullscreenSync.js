import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMenuStore } from '../store/useMenuStore';

/**
 * Hook que sincroniza el modo pantalla completa real del navegador
 * y ajusta el color de la barra superior / status bar de iPadOS (theme-color + surface)
 * para evitar el borde blanco y el blur de Safari/WebKit en vistas oscuras como KDS.
 */
export function useFullscreenSync() {
  const location = useLocation();
  const isFullscreen = useMenuStore((state) => state.isFullscreen);
  const setFullscreen = useMenuStore((state) => state.setFullscreen);

  // Sincronizar estado con el estado real de fullscreen del navegador
  useEffect(() => {
    const syncRealFullscreen = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs !== isFullscreen) {
        setFullscreen(isFs);
      }
    };

    syncRealFullscreen();
    document.addEventListener('fullscreenchange', syncRealFullscreen);
    document.addEventListener('webkitfullscreenchange', syncRealFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncRealFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncRealFullscreen);
    };
  }, [isFullscreen, setFullscreen]);

  // Sincronizar superficie superior y theme-color en Safari iPadOS para que la barra de estado
  // se funda como transparente con el header de cada vista (igual que en iPhone / Chrome)
  useEffect(() => {
    const path = location.pathname;
    let surface = 'light';
    let themeColor = '#ffffff';

    if (path.startsWith('/kds')) {
      surface = 'kds';
      themeColor = '#1e2430';
    } else if (path.startsWith('/display')) {
      surface = 'display';
      themeColor = '#090d16';
    }

    document.documentElement.setAttribute('data-terminal-surface', surface);

    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', themeColor);
  }, [location.pathname]);
}

export default useFullscreenSync;

