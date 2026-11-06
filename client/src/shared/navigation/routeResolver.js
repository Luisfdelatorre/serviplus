/**
 * Resolvedor declarativo de rutas y terminales para Serviplus POS.
 *
 * Centraliza en un solo lugar la traducción entre URL (pathname, search `?tab=`, `#hash`)
 * y la terminal activa (`home`, `kiosk`, `cashier`, `cash-in`, `kds`, `turns`, `admin`),
 * así como la política de pantalla completa por terminal.
 */

const TAB_ALIASES = {
  home: 'home',
  hub: 'home',
  kiosk: 'kiosk',
  autoservice: 'kiosk',
  auto: 'kiosk',
  customers: 'kiosk',
  cashier: 'cashier',
  pos: 'cashier',
  caja: 'cashier',
  'cash-in': 'cash-in',
  apertura: 'cash-in',
  kds: 'kds',
  kitchen: 'kds',
  turns: 'turns',
  turn: 'turns',
  pickup: 'turns',
  admin: 'admin',
  settings: 'admin',
  config: 'admin',
  manage: 'admin'
};

const FULLSCREEN_TABS = new Set(['kds', 'kiosk']);

export function normalizeTabName(raw) {
  if (!raw) return null;
  const clean = String(raw).trim().toLowerCase().replace(/^[/#]+/, '');
  if (TAB_ALIASES[clean]) return TAB_ALIASES[clean];
  for (const [key, target] of Object.entries(TAB_ALIASES)) {
    if (clean.includes(key)) return target;
  }
  return null;
}

export function resolveRouteFromWindow() {
  if (typeof window === 'undefined') {
    return { tab: 'home', fullscreen: false };
  }

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  let tab = normalizeTabName(params.get('tab'));
  if (!tab && hash) {
    tab = normalizeTabName(hash);
  }
  if (!tab && pathname && pathname !== '/' && pathname !== '/react' && pathname !== '/react/') {
    const stripped = pathname.replace(/^\/react\/?/, '');
    tab = normalizeTabName(stripped);
  }
  if (!tab) tab = 'home';

  const explicitFs =
    params.get('fullscreen') === 'true' ||
    params.get('fs') === '1' ||
    params.has('fullscreen') ||
    hash.includes('fullscreen') ||
    hash.includes('autoservice') ||
    pathname.includes('kiosk-fs') ||
    pathname.includes('fullscreen');

  const fullscreen = explicitFs || FULLSCREEN_TABS.has(tab);

  return { tab, fullscreen };
}

export function syncUrlWithTab(tab) {
  if (typeof window === 'undefined') return;
  try {
    const targetHash = tab === 'home' ? '#home' : `#${tab}`;
    if (window.location.hash.toLowerCase() !== targetHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${targetHash}`);
    }
  } catch (_) {}
}

