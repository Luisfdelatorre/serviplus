import { create } from 'zustand';
import { sfx } from '../utils/audio';

export const useCartStore = create((set, get) => ({
  cart: [],
  checkoutType: 'EAT_IN', // 'EAT_IN' | 'TAKE_OUT'
  selectedTable: null,
  selectedTableGroup: null,
  paymentMethod: 'WOMPI_QR',

  addToCart: (item) => {
    sfx.playTap();
    set((state) => {
      const modIds = (item.modifiers || []).map(m => m.id).sort().join('_');
      const itemNotes = (item.notes || '').trim();
      const cartItemId = item.cartItemId || `${item.id}${modIds ? `_m${modIds}` : ''}${itemNotes ? `_n${itemNotes}` : ''}`;

      const existingIndex = state.cart.findIndex(
        (c) => (c.cartItemId || c.id) === cartItemId
      );

      const qtyToAdd = item.quantity || 1;

      if (existingIndex >= 0) {
        const nextCart = [...state.cart];
        nextCart[existingIndex] = {
          ...nextCart[existingIndex],
          quantity: nextCart[existingIndex].quantity + qtyToAdd
        };
        return { cart: nextCart };
      }

      return {
        cart: [
          ...state.cart,
          {
            ...item,
            cartItemId,
            quantity: qtyToAdd
          }
        ]
      };
    });
  },

  updateQuantity: (cartItemId, delta) => {
    sfx.playTap();
    set((state) => {
      const updated = state.cart
        .map((c) => {
          const id = c.cartItemId || c.id;
          if (id === cartItemId || c.id === cartItemId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean);
      return { cart: updated };
    });
  },

  removeFromCart: (cartItemId) => {
    sfx.playTap();
    set((state) => ({
      cart: state.cart.filter((c) => (c.cartItemId || c.id) !== cartItemId && c.id !== cartItemId)
    }));
  },

  clearCart: () => set({ cart: [] }),

  setCheckoutType: (type) => set({ checkoutType: type }),
  setTable: (tableId, group = null) => set({ selectedTable: tableId, selectedTableGroup: group }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  getTotalAmount: () => {
    return get().cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
}));
