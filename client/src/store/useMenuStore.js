import { create } from 'zustand';
import { resolveRouteFromWindow, syncUrlWithTab } from '../shared/navigation/routeResolver';
import { setAuthToken, clearAuthTokens } from '../shared/api/httpClient';

const initialRoute = resolveRouteFromWindow();

function readStoredEmployee() {
  try {
    const stored = localStorage.getItem('terminal_session_employee');
    return stored ? JSON.parse(stored) : null;
  } catch (_) {
    return null;
  }
}

export const useMenuStore = create((set) => ({
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  tables: [],
  employees: [],
  currentCashier: readStoredEmployee()?.id || 1,
  activeTab: initialRoute.tab,
  isFullscreen: initialRoute.fullscreen,
  isKioskFullscreen: initialRoute.fullscreen,

  // Sesión de Empleado / Cajero en Terminal POS
  sessionEmployee: readStoredEmployee(),
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
      if (token) setAuthToken(token, { isAdmin: Boolean(empData?.isAdmin) });
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
      clearAuthTokens();
    } catch (_) {}
    set({ sessionEmployee: null, currentAdmin: null });
  },

  // Estado de Administrador y Configuración
  isAdminLoginOpen: false,
  isAdminSettingsOpen: false,
  currentAdmin: null,
  openAdminLogin: () => set({ isAdminLoginOpen: true }),
  closeAdminLogin: () => set({ isAdminLoginOpen: false }),
  openAdminSettings: (adminData, token = null) => {
    if (token) setAuthToken(token, { isAdmin: true });
    syncUrlWithTab('admin');
    set({
      isAdminLoginOpen: false,
      isAdminSettingsOpen: false,
      currentAdmin: adminData || null,
      activeTab: 'admin'
    });
  },
  closeAdminSettings: () => set({ isAdminSettingsOpen: false }),

  setCategories: (cats) =>
    set((state) => ({
      categories: cats,
      selectedCategory: state.selectedCategory || null
    })),
  setSelectedCategory: (catName) => set({ selectedCategory: catName }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTables: (tables) => set({ tables }),
  setEmployees: (employees) => set({ employees }),
  setCurrentCashier: (id) => set({ currentCashier: id }),
  setActiveTab: (tab) => {
    syncUrlWithTab(tab);
    set({ activeTab: tab });
  },
  toggleFullscreen: () =>
    set((state) => ({
      isFullscreen: !state.isFullscreen,
      isKioskFullscreen: !state.isFullscreen
    })),
  setFullscreen: (val) => set({ isFullscreen: Boolean(val), isKioskFullscreen: Boolean(val) }),
  toggleKioskFullscreen: () =>
    set((state) => ({
      isFullscreen: !state.isFullscreen,
      isKioskFullscreen: !state.isFullscreen
    })),
  setKioskFullscreen: (val) => set({ isFullscreen: Boolean(val), isKioskFullscreen: Boolean(val) })
}));
