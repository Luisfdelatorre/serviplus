import { create } from 'zustand';

const getInitialTab = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['home', 'kiosk', 'cashier', 'kds', 'turns', 'pos', 'cash-in', 'apertura', 'admin', 'settings', 'config'].includes(tabParam.toLowerCase())) {
      if (tabParam.toLowerCase() === 'pos') return 'cashier';
      if (tabParam.toLowerCase() === 'apertura') return 'cash-in';
      if (tabParam.toLowerCase() === 'settings' || tabParam.toLowerCase() === 'config') return 'admin';
      return tabParam.toLowerCase();
    }
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('cash-in') || hash.includes('apertura')) return 'cash-in';
    if (hash.includes('admin') || hash.includes('settings') || hash.includes('config') || hash.includes('manage')) return 'admin';
    if (hash.includes('home')) return 'home';
    if (hash.includes('pos') || hash.includes('cashier') || hash.includes('caja')) return 'cashier';
    if (hash.includes('pickup') || hash.includes('turn')) return 'turns';
    if (hash.includes('kds')) return 'kds';
    if (hash.includes('kiosk') || hash.includes('autoservice') || hash.includes('auto') || hash.includes('customers')) return 'kiosk';

    const pathname = window.location.pathname.toLowerCase();
    if (pathname === '/' || pathname === '') return 'home';
    if (pathname.includes('kds')) return 'kds';
    if (pathname.includes('cashier') || pathname.includes('pos')) return 'cashier';
    if (pathname.includes('turns') || pathname.includes('pickup')) return 'turns';
    if (pathname.includes('kiosk') || pathname.includes('autoservice')) return 'kiosk';
  }
  return 'home';
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

  // Sesión de Empleado / Cajero en Terminal POS
  sessionEmployee: (() => {
    try {
      const stored = localStorage.getItem('terminal_session_employee');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  })(),
  isLoginModalOpen: false,
  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),

  // Modal de Entrada y Salida de Cajero (Apertura y Cierre Z)
  isCashShiftModalOpen: false,
  openCashShiftModal: () => set({ isCashShiftModalOpen: true }),
  closeCashShiftModal: () => set({ isCashShiftModalOpen: false }),
  loginEmployee: (empData, token) => {
    try {
      localStorage.setItem('terminal_session_employee', JSON.stringify(empData));
      if (token) localStorage.setItem('terminal_session_token', token);
    } catch (_) {}
    set({
      sessionEmployee: empData,
      currentCashier: (empData && empData.id) || 1,
      isLoginModalOpen: false
    });
  },
  logoutEmployee: () => {
    try {
      localStorage.removeItem('terminal_session_employee');
      localStorage.removeItem('terminal_session_token');
    } catch (_) {}
    set({ sessionEmployee: null });
  },

  // Estado de Administrador y Configuración
  isAdminLoginOpen: false,
  isAdminSettingsOpen: false,
  currentAdmin: null,
  openAdminLogin: () => set({ isAdminLoginOpen: true }),
  closeAdminLogin: () => set({ isAdminLoginOpen: false }),
  openAdminSettings: (adminData) => set({
    isAdminLoginOpen: false,
    isAdminSettingsOpen: false,
    currentAdmin: adminData || null,
    activeTab: 'admin'
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
