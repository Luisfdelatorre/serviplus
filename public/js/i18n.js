/**
 * Serviplus i18n Internationalization Engine
 * Default Language: Spanish ('es')
 * Supported: 'es', 'en'
 */

const I18N_DICTIONARY = {
  es: {
    // Top Navigation
    nav_brand_sub: "KIOSK & KDS",
    nav_kiosk: "Kiosk Autoservicio",
    nav_frontdesk: "Front Desk Caja",
    nav_kds: "KDS Cocina",
    nav_turns: "Monitor de Turnos",
    status_online: "En línea",
    status_offline: "Desconectado",

    // Banner
    banner_pill: "🔥 ¡RECIÉN PREPARADO!",
    banner_headline: "Disfruta tu comida favorita",
    banner_sub: "Toca cualquier producto para añadirlo a tu orden",

    // Catalog & Search
    search_placeholder: "Buscar producto...",
    all_products: "Todos los productos",
    loading_menu: "Cargando menú...",
    items_count: "{n} productos",
    items_found: "{n} encontrados",
    search_results: "Resultados para \"{q}\"",
    no_products: "No se encontraron productos",

    // Cart
    cart_title: "Mi Pedido",
    cart_items_count: "{n} ítems",
    cart_eat_in: "🍽️ Comer Aquí",
    cart_take_out: "🥡 Para Llevar",
    cart_empty_title: "Tu orden está vacía",
    cart_empty_desc: "Selecciona productos a la izquierda para empezar.",
    cart_unit: "c/u",
    cart_total: "Total a Pagar:",
    cart_checkout: "Finalizar y Pagar",
    cart_cancel: "Cancelar Pedido",

    // Front Desk
    fd_attended_by: "Atendido por:",
    fd_cashier_mode: "Modo Cajero: Efectivo, Tarjeta o QR Wompi",
    fd_menu_title: "Menú de Mostrador",
    fd_order_title: "Orden Mostrador",
    fd_cart_empty_title: "Sin productos",
    fd_cart_empty_desc: "Toca los productos para cobrar.",
    fd_total_label: "Total a Cobrar:",
    fd_collect_btn: "💵 Cobrar Orden",
    fd_clear_btn: "Limpiar Pedido",

    // KDS Kitchen
    kds_clock_prefix: "",
    kds_tab_open: "Abiertas",
    kds_tab_completed: "Completadas",
    kds_btn_start: "Empezar a Cocinar",
    kds_btn_done: "Marcar como Listo",
    kds_btn_served: "Servido / Cerrar",
    kds_table: "Mesa {n}",
    kds_takeout: "Para Llevar #{n}",
    kds_empty_cooking: "🎉 Cocina al día. No hay pedidos pendientes.",
    kds_empty_completed: "No hay pedidos completados recientemente.",
    kds_fullscreen_tip: "Pantalla Completa Cocina",

    // Turns Monitor
    turns_prep_title: "🟡 EN PREPARACIÓN",
    turns_ready_title: "🟢 ¡LISTOS PARA RETIRAR!",

    // Checkout Modal - Step 1
    modal_step1_label: "Paso 1: Localizador o Mesa",
    modal_step2_label: "Paso 2: Método de Pago y Confirmación",
    dining_eat_in: "Comer en Salón",
    dining_takeout: "Para Llevar",
    badge_active: "ACTIVO",
    prompt_select_table: "¿Cuál es tu número de mesa o localizador?",
    takeout_card_title: "Pedido Para Llevar",
    takeout_card_desc: "Tu pedido será empacado para llevar. Al confirmar el pago recibirás tu <strong>Número de Turno</strong> para retirar en barra.",
    chip_change: "Cambiar",
    chip_table_prefix: "Mesa #{n}",
    chip_takeaway: "Para Llevar (Retiro por turno)",
    chip_no_pager: "Llamar por Ticket (Sin localizador)",

    // Checkout Modal - Step 2
    modal_total_label: "Total a pagar",
    pay_opt_wompi: "QR Wompi",
    pay_opt_cash: "Efectivo",
    pay_opt_dataphone: "Datáfono",
    wompi_prompt: "Escanea con tu App Nequi, Bancolombia o Daviplata:",
    cash_received_label: "Efectivo Recibido:",
    cash_change_label: "Cambio:",
    btn_back_menu: "Volver al Menú",
    btn_back_step1: "Volver a Mesa",
    btn_continue_pay: "Continuar al Pago",
    btn_confirm_order: "Confirmar Pedido",
    btn_simulate_wompi: "Simular Pago Exitoso Wompi",
    btn_cash_submit: "Cobrar en Efectivo y Crear Orden",
    btn_dataphone_submit: "Confirmar Pago con Datáfono",
    btn_processing: "Procesando en Aldelo...",

    // Success Modal
    success_title: "¡Orden Confirmada!",
    success_desc: "Tu pedido ha sido enviado a la cocina.",
    success_table_label: "Tu Mesa:",
    success_order_label: "Tu Número de Turno:",
    success_table_instr: "Toma asiento en la Mesa #{n}. Enseguida te llevamos tu comida.",
    success_takeaway_instr: "Mira el monitor de turnos cuando tu pedido esté listo para retirar.",
    success_aldelo_id: "Orden Aldelo ID: {id}",
    success_btn_done: "Listo / Nueva Orden"
  },

  en: {
    // Top Navigation
    nav_brand_sub: "KIOSK & KDS",
    nav_kiosk: "Self-Service Kiosk",
    nav_frontdesk: "Front Desk Cashier",
    nav_kds: "Kitchen KDS",
    nav_turns: "Order Turns Monitor",
    status_online: "Online",
    status_offline: "Offline",

    // Banner
    banner_pill: "🔥 FRESHLY PREPARED!",
    banner_headline: "Enjoy your favorite food",
    banner_sub: "Touch any item to add it to your order",

    // Catalog & Search
    search_placeholder: "Search product...",
    all_products: "All products",
    loading_menu: "Loading menu...",
    items_count: "{n} items",
    items_found: "{n} found",
    search_results: "Results for \"{q}\"",
    no_products: "No products found",

    // Cart
    cart_title: "My Order",
    cart_items_count: "{n} items",
    cart_eat_in: "🍽️ Dine In",
    cart_take_out: "🥡 Take Away",
    cart_empty_title: "Your order is empty",
    cart_empty_desc: "Select items on the left to get started.",
    cart_unit: "ea",
    cart_total: "Total to Pay:",
    cart_checkout: "💳 Checkout & Pay",
    cart_cancel: "Cancel Order",

    // Front Desk
    fd_attended_by: "Served by:",
    fd_cashier_mode: "Cashier Mode: Cash, Card or Wompi QR",
    fd_menu_title: "Counter Menu",
    fd_order_title: "Counter Order",
    fd_cart_empty_title: "No items",
    fd_cart_empty_desc: "Touch products to charge.",
    fd_total_label: "Total to Charge:",
    fd_collect_btn: "💵 Charge Order",
    fd_clear_btn: "Clear Order",

    // KDS Kitchen
    kds_clock_prefix: "",
    kds_tab_open: "Open",
    kds_tab_completed: "Completed",
    kds_btn_start: "Start Cooking",
    kds_btn_done: "Mark as Done",
    kds_btn_served: "Served / Close",
    kds_table: "Table {n}",
    kds_takeout: "Take Out #{n}",
    kds_empty_cooking: "🎉 Kitchen up to date. No pending orders.",
    kds_empty_completed: "No recently completed orders.",
    kds_fullscreen_tip: "Kitchen Fullscreen",

    // Turns Monitor
    turns_prep_title: "🟡 PREPARING",
    turns_ready_title: "🟢 READY FOR PICKUP!",

    // Checkout Modal - Step 1
    modal_step1_label: "Step 1: Pager or Table",
    modal_step2_label: "Step 2: Payment Method & Confirmation",
    dining_eat_in: "Dine In",
    dining_takeout: "Take Away",
    badge_active: "ACTIVE",
    prompt_select_table: "What is your table or pager number?",
    takeout_card_title: "Take Away Order",
    takeout_card_desc: "Your order will be packed to take away. Upon payment confirmation you will receive your <strong>Turn Number</strong> to pick up at the counter.",
    chip_change: "Change",
    chip_table_prefix: "Table #{n}",
    chip_takeaway: "Take Away (Pickup by turn)",
    chip_no_pager: "Call by Ticket (No pager)",

    // Checkout Modal - Step 2
    modal_total_label: "Total to pay",
    pay_opt_wompi: "Wompi QR",
    pay_opt_cash: "Cash",
    pay_opt_dataphone: "Card Terminal",
    wompi_prompt: "Scan with your Banking App (Nequi, Bancolombia, etc.):",
    cash_received_label: "Cash Tendered:",
    cash_change_label: "Change:",
    btn_back_menu: "Back to Menu",
    btn_back_step1: "Back to Table",
    btn_continue_pay: "Continue to Payment",
    btn_confirm_order: "Confirm Order",
    btn_simulate_wompi: "Simulate Successful Wompi Payment",
    btn_cash_submit: "Collect Cash & Create Order",
    btn_dataphone_submit: "Confirm Card Payment",
    btn_processing: "Processing in Aldelo...",

    // Success Modal
    success_title: "Order Confirmed!",
    success_desc: "Your order has been sent to the kitchen.",
    success_table_label: "Your Table:",
    success_order_label: "Your Turn Number:",
    success_table_instr: "Take a seat at Table #{n}. Your meal will be served shortly.",
    success_takeaway_instr: "Check the order screen when your food is ready for pickup.",
    success_aldelo_id: "Aldelo Order ID: {id}",
    success_btn_done: "Done / New Order"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = localStorage.getItem('serviplus_lang') || 'es';
    this.listeners = [];
  }

  getLang() {
    return this.currentLang;
  }

  t(key, params = {}) {
    const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY['es'];
    let text = dict[key] || I18N_DICTIONARY['es'][key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  }

  setLang(lang) {
    if (!I18N_DICTIONARY[lang]) lang = 'es';
    this.currentLang = lang;
    localStorage.setItem('serviplus_lang', lang);
    document.documentElement.lang = lang;

    // Update switcher buttons UI
    document.querySelectorAll('.lang-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update static DOM elements
    this.updateDom();

    // Notify listeners
    this.listeners.forEach(fn => {
      try { fn(lang); } catch (e) { console.error('Error in i18n listener:', e); }
    });
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  updateDom() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', this.t(key));
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', this.t(key));
      }
    });
  }

  init() {
    document.documentElement.lang = this.currentLang;
    this.updateDom();
    document.querySelectorAll('.lang-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
    });
  }
}

// Global instance
window.i18n = new I18nManager();
window.t = (key, params) => window.i18n.t(key, params);
window.setLanguage = (lang) => window.i18n.setLang(lang);
