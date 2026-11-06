import { create } from 'zustand';
import { resolveRouteFromWindow, syncUrlWithTab } from '../shared/navigation/routeResolver';

const initialRoute = resolveRouteFromWindow();

export const useNavigationStore = create((set) => ({
  activeTab: initialRoute.tab,
  isFullscreen: initialRoute.fullscreen,
  isKioskFullscreen: initialRoute.fullscreen,
  isCashShiftModalOpen: false,
  isAdminSettingsOpen: false,

  setActiveTab: (tab) => {
    syncUrlWithTab(tab);
    set({ activeTab: tab });
  },
  setFullscreen: (val) => set({ isFullscreen: Boolean(val), isKioskFullscreen: Boolean(val) }),
  toggleFullscreen: () =>
    set((state) => ({
      isFullscreen: !state.isFullscreen,
      isKioskFullscreen: !state.isFullscreen
    })),

  openCashShiftModal: () => set({ isCashShiftModalOpen: true }),
  closeCashShiftModal: () => set({ isCashShiftModalOpen: false }),
  openAdminSettingsModal: () => set({ isAdminSettingsOpen: true }),
  closeAdminSettingsModal: () => set({ isAdminSettingsOpen: false })
}));
