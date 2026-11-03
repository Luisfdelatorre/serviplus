import { create } from 'zustand';

const getInitialTab = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['kiosk', 'cashier', 'kds', 'turns'].includes(tabParam.toLowerCase())) {
      return tabParam.toLowerCase();
    }
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('kds')) return 'kds';
    if (hash.includes('cashier') || hash.includes('caja')) return 'cashier';
    if (hash.includes('turn')) return 'turns';
    if (hash.includes('kiosk') || hash.includes('autoservice') || hash.includes('auto')) return 'kiosk';

    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('kds')) return 'kds';
    if (pathname.includes('cashier')) return 'cashier';
    if (pathname.includes('turns')) return 'turns';
    if (pathname.includes('kiosk') || pathname.includes('autoservice')) return 'kiosk';
  }
  return 'kiosk';
};

const getInitialFullscreen = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (
      params.get('fullscreen') === 'true' ||
      params.get('fs') === '1' ||
      params.has('fullscreen') ||
      (tabParam && tabParam.toLowerCase() === 'kds')
    ) {
      return true;
    }
    const hash = window.location.hash.toLowerCase();
    if (
      hash.includes('fullscreen') ||
      hash.includes('fs') ||
      hash.includes('autoservice') ||
      hash.includes('kds') ||
      hash === '#/kiosk' ||
      hash === '#kiosk'
    ) {
      return true;
    }
    const pathname = window.location.pathname.toLowerCase();
    if (
      pathname.includes('kds') ||
      pathname === '/kiosk' ||
      pathname === '/kiosk/' ||
      pathname.endsWith('/kiosk') ||
      pathname.endsWith('/kiosk/') ||
      pathname.includes('fullscreen') ||
      pathname.includes('autoservice') ||
      pathname.includes('kiosk-fs')
    ) {
      return true;
    }
  }
  return false;
};

export const useMenuStore = create((set) => ({
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  tables: [],
  employees: [],
  currentCashier: 1,
  activeTab: getInitialTab(),
  isFullscreen: getInitialFullscreen(),
  isKioskFullscreen: getInitialFullscreen(),

  // Estado de Administrador y Configuración
  isAdminLoginOpen: false,
  isAdminSettingsOpen: false,
  currentAdmin: null,
  openAdminLogin: () => set({ isAdminLoginOpen: true }),
  closeAdminLogin: () => set({ isAdminLoginOpen: false }),
  openAdminSettings: (adminData) => set({
    isAdminLoginOpen: false,
    isAdminSettingsOpen: true,
    currentAdmin: adminData || null
  }),
  closeAdminSettings: () => set({ isAdminSettingsOpen: false }),

  setCategories: (cats) => set((state) => ({
    categories: cats,
    selectedCategory: state.selectedCategory || null
  })),
  setSelectedCategory: (catName) => set({ selectedCategory: catName }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTables: (tables) => set({ tables }),
  setEmployees: (employees) => set({ employees }),
  setCurrentCashier: (id) => set({ currentCashier: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen, isKioskFullscreen: !state.isFullscreen })),
  setFullscreen: (val) => set({ isFullscreen: val, isKioskFullscreen: val }),
  toggleKioskFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen, isKioskFullscreen: !state.isFullscreen })),
  setKioskFullscreen: (val) => set({ isFullscreen: val, isKioskFullscreen: val })
}));
