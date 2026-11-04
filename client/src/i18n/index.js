import { create } from 'zustand';

export const DICTIONARY = {
  es: {
    // KDS
    kds_takeout: 'Llevar',
    kds_table: 'Mesa {table}',
    kds_order_title_takeout: '#{orderNumber} : Llevar',
    kds_order_title_table: '#{orderNumber}',
    kds_revert: 'Revertir',
    kds_mark_served: 'Entregar',
    kds_mark_ready: 'Marcar como Lista',
    kds_aria_revert: 'Revertir pedido',
    kds_aria_served: 'Marcar pedido como entregada',
    kds_aria_ready: 'Marcar pedido como lista',
    kds_min: 'min',
    kds_h: 'h',
    kds_m: 'm',
    kds_all_ready: '🎉 Todo listo en cocina',
    kds_prep_time: '⏱️ Prep: {time} min',
    kds_open_orders: 'Órdenes Abiertas',
    kds_completed_orders: 'Completadas',
    kds_filter_prep: 'En Preparación',
    kds_filter_ready: 'Listas',
    kds_empty_prep: '🎉 No hay pedidos en preparación.',
    kds_empty_ready: '🎉 No hay pedidos listos.',

    // Kiosk & General
    kiosk_title: 'Kiosk Autoservicio',
    cashier_title: 'Front Desk Caja',
    turns_title: 'Monitor de Turnos',
    cart_my_order: 'Mi Pedido',
    cart_empty: 'Tu orden está vacía',
    cart_pay: 'Finalizar y Pagar',
    dining_eat_in: 'Comer en Mesa',
    dining_take_out: 'Para Llevar',
    checkout_select_table: 'Selecciona tu mesa para continuar',
    checkout_table_selected: 'Mesa seleccionada: #{table}'
  },
  en: {
    // KDS
    kds_takeout: 'Take Away',
    kds_table: 'Table {table}',
    kds_order_title_takeout: '#{orderNumber} : Take Away',
    kds_order_title_table: '#{orderNumber} : Table {table}',
    kds_revert: 'Revert',
    kds_mark_served: 'Served',
    kds_mark_ready: 'Mark as Ready',
    kds_aria_revert: 'Revert order',
    kds_aria_served: 'Mark order as served',
    kds_aria_ready: 'Mark order as ready',
    kds_min: 'min',
    kds_h: 'h',
    kds_m: 'm',
    kds_all_ready: '🎉 All orders ready',
    kds_prep_time: '⏱️ Prep: {time} min',
    kds_open_orders: 'Open Orders',
    kds_completed_orders: 'Completed',
    kds_filter_prep: 'Preparing',
    kds_filter_ready: 'Ready',
    kds_empty_prep: '🎉 No orders preparing.',
    kds_empty_ready: '🎉 No ready orders.',

    // Kiosk & General
    kiosk_title: 'Self-Service Kiosk',
    cashier_title: 'Front Desk Cashier',
    turns_title: 'Turns Monitor',
    cart_my_order: 'My Order',
    cart_empty: 'Your order is empty',
    cart_pay: 'Checkout & Pay',
    dining_eat_in: 'Dine In',
    dining_take_out: 'Take Away',
    checkout_select_table: 'Select your table to continue',
    checkout_table_selected: 'Selected table: #{table}'
  }
};

const initialLang = (typeof window !== 'undefined' && localStorage.getItem('serviplus_lang')) || 'es';

export const useI18nStore = create((set, get) => ({
  lang: initialLang,
  setLang: (newLang) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('serviplus_lang', newLang);
      } catch (e) { }
    }
    set({ lang: newLang });
  },
  t: (key, params = {}) => {
    const currentLang = get().lang || 'es';
    let text = DICTIONARY[currentLang]?.[key] || DICTIONARY['es']?.[key] || key;
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return text;
  }
}));

export function useI18n() {
  const lang = useI18nStore((state) => state.lang);
  const setLang = useI18nStore((state) => state.setLang);
  const t = useI18nStore((state) => state.t);
  return { lang, setLang, t };
}
