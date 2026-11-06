import { create } from 'zustand';
import { setAuthToken, clearAuthTokens } from '../shared/api/httpClient';

function readStoredEmployee() {
  try {
    const stored = localStorage.getItem('terminal_session_employee');
    return stored ? JSON.parse(stored) : null;
  } catch (_) {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  sessionEmployee: readStoredEmployee(),
  currentCashier: readStoredEmployee()?.id || 1,
  isLoginModalOpen: false,
  isAdminLoginOpen: false,
  currentAdmin: null,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),

  openAdminLogin: () => set({ isAdminLoginOpen: true }),
  closeAdminLogin: () => set({ isAdminLoginOpen: false }),

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

  setCurrentAdmin: (adminData, token = null) => {
    if (token) setAuthToken(token, { isAdmin: true });
    set({ currentAdmin: adminData || null, isAdminLoginOpen: false });
  }
}));

