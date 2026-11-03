import { create } from 'zustand';
import { updateKdsStatus, updateOrderStatus } from '../api';
import { sfx } from '../utils/audio';
import { socket } from '../socket';

// Helper para determinar estado KDS
export function getOrderKdsStatus(order) {
  if (order.kdsStatus === 'SERVED' || order.packagerPrinted) return 'SERVED';
  if (order.tableReady || order.TableReady || order.kdsStatus === 'READY') return 'READY';
  // Si la orden no está pagada (Efectivo o Datáfono desde Kiosk), NO va a cocina hasta pagar en Front Desk
  if (order.kdsStatus === 'WAITING_PAYMENT' || order.isPaid === false || order.status === '1') {
    return 'WAITING_PAYMENT';
  }
  return 'PREPARING';
}

export const useKdsStore = create((set, get) => ({
  activeOrders: [],
  kdsFilter: 'PREP', // 'PREP' | 'READY'
  kdsPage: 1,
  kdsScale: localStorage.getItem('kds_scale') || 'normal',
  kdsAutoFit: localStorage.getItem('kds_autofit') === 'true',
  isMirrorMode: localStorage.getItem('kds_mirror_mode') !== 'false',
  kdsTheme: localStorage.getItem('kds_theme') || 'light',
  kdsItemChecks: {},

  setActiveOrders: (orders) => set({ activeOrders: orders }),

  toggleKdsTheme: (broadcast = true) => {
    sfx.playTap();
    const nextTheme = get().kdsTheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('kds_theme', nextTheme);
    } catch (e) {}
    try {
      document.documentElement.setAttribute('data-kds-theme', nextTheme);
    } catch (e) {}
    set({ kdsTheme: nextTheme });
    if (broadcast && get().isMirrorMode) {
      try {
        socket.emit('kds:mirror_sync', { kdsTheme: nextTheme });
      } catch (e) {}
    }
  },

  setKdsTheme: (theme, broadcast = true) => {
    try {
      localStorage.setItem('kds_theme', theme);
    } catch (e) {}
    try {
      document.documentElement.setAttribute('data-kds-theme', theme);
    } catch (e) {}
    set({ kdsTheme: theme });
    if (broadcast && get().isMirrorMode) {
      try {
        socket.emit('kds:mirror_sync', { kdsTheme: theme });
      } catch (e) {}
    }
  },

  toggleMirrorMode: () => {
    sfx.playTap();
    const nextVal = !get().isMirrorMode;
    try {
      localStorage.setItem('kds_mirror_mode', nextVal ? 'true' : 'false');
    } catch (e) {}
    set({ isMirrorMode: nextVal });
  },

  addOrder: (newOrder) => {
    sfx.playOrderBell();
    set((state) => {
      const exists = state.activeOrders.some((o) => o.id === newOrder.id);
      if (exists) {
        return {
          activeOrders: state.activeOrders.map((o) => (o.id === newOrder.id ? { ...o, ...newOrder } : o))
        };
      }
      return { activeOrders: [newOrder, ...state.activeOrders] };
    });
  },

  updateLocalOrder: (orderId, partial) => {
    set((state) => ({
      activeOrders: state.activeOrders.map((o) => (o.id === orderId ? { ...o, ...partial } : o))
    }));
  },

  setKdsFilter: (filter, broadcast = true) => {
    sfx.playTap();
    set({ kdsFilter: filter, kdsPage: 1 });
    if (broadcast && get().isMirrorMode) {
      try {
        socket.emit('kds:mirror_sync', { kdsFilter: filter, kdsPage: 1 });
      } catch (e) {}
    }
  },

  setKdsPage: (page, broadcast = true) => {
    sfx.playTap();
    set({ kdsPage: page });
    if (broadcast && get().isMirrorMode) {
      try {
        socket.emit('kds:mirror_sync', { kdsPage: page });
      } catch (e) {}
    }
  },

  setKdsScale: (scale) => {
    sfx.playTap();
    try {
      localStorage.setItem('kds_scale', scale);
    } catch (e) {}
    set({ kdsScale: scale, kdsPage: 1 });
  },

  toggleKdsAutoFit: () => {
    sfx.playTap();
    const nextVal = !get().kdsAutoFit;
    try {
      localStorage.setItem('kds_autofit', nextVal ? 'true' : 'false');
    } catch (e) {}
    set({ kdsAutoFit: nextVal, kdsPage: 1 });
  },

  toggleItemCheck: async (orderId, itemId) => {
    sfx.playTap();
    const key = `${orderId}_${itemId}`;
    const nextChecked = !get().kdsItemChecks[key];

    // Optimistic UI update
    set((state) => {
      const updatedChecks = { ...state.kdsItemChecks, [key]: nextChecked };
      const updatedOrders = state.activeOrders.map((ord) => {
        if (ord.id === orderId) {
          const ordChecks = { ...(ord.kdsItemChecks || {}), [key]: nextChecked };
          return { ...ord, kdsItemChecks: ordChecks };
        }
        return ord;
      });
      return { kdsItemChecks: updatedChecks, activeOrders: updatedOrders };
    });

    try {
      const ord = get().activeOrders.find((o) => o.id === orderId);
      const currentStatus = ord ? getOrderKdsStatus(ord) : 'PREPARING';
      await updateKdsStatus(orderId, currentStatus, { [key]: nextChecked });
    } catch (e) {
      console.error('[KDS] Error sincronizando check de item:', e);
    }
  },

  setOrderState: async (orderId, nextKdsStatus) => {
    sfx.playTap();
    const ord = get().activeOrders.find((o) => o.id === orderId);
    if (!ord) return;

    // Optimistic update
    if (nextKdsStatus === 'READY') {
      sfx.playReadyChime();
      get().updateLocalOrder(orderId, { kdsStatus: 'READY', tableReady: true, packagerPrinted: false });
    } else if (nextKdsStatus === 'SERVED') {
      sfx.playTap();
      get().updateLocalOrder(orderId, { kdsStatus: 'SERVED', tableReady: false, packagerPrinted: true });
    } else if (nextKdsStatus === 'PREPARING') {
      get().updateLocalOrder(orderId, { kdsStatus: 'PREPARING', tableReady: false, packagerPrinted: false });
    }

    try {
      await updateKdsStatus(orderId, nextKdsStatus);
    } catch (e) {
      console.error('[KDS] Error actualizando estado comanda:', e);
    }
  }
}));
