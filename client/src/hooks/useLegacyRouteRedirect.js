import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LEGACY_ROUTE_MAP = {
  home: '/',
  hub: '/',
  kiosk: '/kiosk',
  autoservice: '/kiosk',
  auto: '/kiosk',
  customers: '/kiosk',
  front: '/front',
  pos: '/front',
  cashier: '/front',
  caja: '/front',
  'cash-in': '/front/cash-in',
  apertura: '/front/cash-in',
  kds: '/kds',
  kitchen: '/kds',
  cocina: '/kds',
  turns: '/display',
  turn: '/display',
  display: '/display',
  pickup: '/display',
  admin: '/admin',
  settings: '/admin',
  config: '/admin'
};

/**
 * Hook para redireccionar parámetros query o hash antiguos (?tab= o #hash)
 * hacia las nuevas rutas canónicas de React Router (/front, /kiosk, /kds, etc.)
 */
export function useLegacyRouteRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const legacyTab = params.get('tab');
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    const route = (legacyTab || hash || '').toLowerCase();

    if (route && LEGACY_ROUTE_MAP[route]) {
      navigate(LEGACY_ROUTE_MAP[route], { replace: true });
    }
  }, [navigate, location.pathname]);
}

export default useLegacyRouteRedirect;

