import { useLocation } from 'react-router-dom';
import { useMenuStore } from '../store/useMenuStore';

const NO_HEADER_ROUTES = ['/', '/front', '/front/cash-in', '/admin'];

/**
 * Hook para determinar la visibilidad del Header de navegación superior.
 * Oculta el header en pantalla completa o en vistas dedicadas (Hub, Arqueo de caja, Admin).
 */
export function useShowHeader() {
  const location = useLocation();
  const isFullscreen = useMenuStore((state) => state.isFullscreen);

  const isExcluded = NO_HEADER_ROUTES.includes(location.pathname);
  return !isFullscreen && !isExcluded;
}

export default useShowHeader;

