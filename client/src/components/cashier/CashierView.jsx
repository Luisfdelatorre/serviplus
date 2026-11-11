import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Wifi,
  Battery,
  BatteryCharging,
  Search,
  Flame,
  Sparkles,
  SlidersHorizontal,
  Receipt,
  Minus,
  Plus,
  Trash2,
  MessageSquare,
  ChefHat,
  CreditCard,
  X,
  Banknote,
  QrCode,
  CheckCircle2,
  Boxes,
  CheckCheck,
  Maximize2,
  Minimize2,
  Zap,
  Cast,
  Sun,
  Moon,
  Scan,
  RefreshCw,
  Utensils,
  Timer,
  Wallet,
  Eye,
  Pencil,
  Hourglass,
  ShoppingBag,
  ClipboardList
} from 'lucide-react';
import { useMenuStore } from '../../store/useMenuStore';
import { useKdsStore } from '../../store/useKdsStore';
import {
  fetchEmployees,
  fetchActiveOrders,
  createOrder,
  updateOrderStatus,
  fetchTables,
  fetchAdminProducts,
  toggleProductActive,
  fetchCurrentCashShift
} from '../../api';
import { formatCOP, getElapsedMinutes } from '../../utils/format';
import { getProductImageUrl } from '../../utils/productImages';
import { enterFullscreen, exitFullscreen } from '../../utils/fullscreen';
import { sfx } from '../../utils/audio';
import { ModifierModal } from '../kiosk/ModifierModal';
import { CashShiftModal } from './CashShiftModal';
import { SettlePaymentModal } from './SettlePaymentModal';
import { ProductAvailabilityModal } from '../admin/ProductAvailabilityModal';
import { showAlert, showConfirm } from '../../store/useAlertDialogStore';
import './CashierView.css';

const POS_PRODUCT_IMAGES = {
  kebab_pollo: '/images/kebab_pollo.jpg',
  kebab_carne: '/images/kebab_carne.jpg',
  kebab_mixto: '/images/kebab_mixto.jpg',
  kebab_especial: '/images/kebab_carne.jpg',
  hamburguesa: '/images/aperitivo.jpg',
  shawarma: '/images/kebab_mixto.jpg'
};

function getPosProductImage(item = {}) {
  if (item.image) return item.image;
  if (item.imageUrl) return item.imageUrl;

  const n = (item.name || '').toLowerCase();
  const c = (item.categoryName || '').toLowerCase();

  if (n.includes('hamburguesa') || n.includes('burger')) return POS_PRODUCT_IMAGES.hamburguesa;
  if (n.includes('shawarma') && n.includes('mixto')) return POS_PRODUCT_IMAGES.kebab_mixto;
  if (n.includes('shawarma') || c.includes('shawarma')) return POS_PRODUCT_IMAGES.shawarma;
  if (n.includes('especial') && n.includes('carne')) return POS_PRODUCT_IMAGES.kebab_especial;
  if (n.includes('especial') && n.includes('pollo')) return POS_PRODUCT_IMAGES.kebab_pollo;
  if (n.includes('especial')) return POS_PRODUCT_IMAGES.kebab_especial;
  if (n.includes('mixto')) return POS_PRODUCT_IMAGES.kebab_mixto;
  if (n.includes('carne') || n.includes('ranchero')) return POS_PRODUCT_IMAGES.kebab_carne;
  if (n.includes('pollo') || n.includes('kebab') || c.includes('kebab')) return POS_PRODUCT_IMAGES.kebab_pollo;

  return getProductImageUrl(item, item.categoryName);
}

export function CashierView() {
  const navigate = useNavigate();
  const categories = useMenuStore((state) => state.categories);
  const sessionEmployee = useMenuStore((state) => state.sessionEmployee);
  const isFullscreen = useMenuStore((state) => state.isFullscreen);
  const setFullscreen = useMenuStore((state) => state.setFullscreen);
  const activeOrders = useKdsStore((state) => state.activeOrders);
  const setActiveOrders = useKdsStore((state) => state.setActiveOrders);
  const kdsTheme = useKdsStore((state) => state.kdsTheme);
  const toggleKdsTheme = useKdsStore((state) => state.toggleKdsTheme);
  const [isSyncing, setIsSyncing] = useState(false);

  // Recarga las órdenes activas desde el servidor (no depende del socket).
  const refreshActiveOrders = async () => {
    try {
      const orders = await fetchActiveOrders();
      if (Array.isArray(orders)) setActiveOrders(orders);
    } catch (err) {
      console.warn('No se pudieron recargar las órdenes activas:', err.message);
    }
  };

  const handleSyncOrders = async () => {
    sfx.playTap();
    setIsSyncing(true);
    try {
      const [orders, prods, shiftRes] = await Promise.all([
        fetchActiveOrders().catch(() => null),
        fetchAdminProducts().catch(() => null),
        fetchCurrentCashShift().catch(() => null)
      ]);
      if (Array.isArray(orders)) setActiveOrders(orders);
      if (Array.isArray(prods)) setAdminProducts(prods);
      if (shiftRes && shiftRes.shift) setCashShift(shiftRes);
    } finally {
      setTimeout(() => setIsSyncing(false), 350);
    }
  };

  const handleToggleFullscreen = () => {
    sfx.playTap();
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      enterFullscreen();
      setFullscreen(true);
    } else {
      exitFullscreen();
      setFullscreen(false);
    }
  };

  // Reloj, fecha y telemetría de dispositivo (iOS App Shell)
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cashShift, setCashShift] = useState({ isOpen: true, shift: { id: 3 } });

  // Modales de Turno de Caja y Agotados
  const [showCashShiftModal, setShowCashShiftModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  // Modo iOS Shaking / Wiggle para Agotados en directo
  const [isStockJiggleMode, setIsStockJiggleMode] = useState(false);
  const [adminProducts, setAdminProducts] = useState([]);
  const [togglingItemId, setTogglingItemId] = useState(null);
  const [holdingItemId, setHoldingItemId] = useState(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  // Estados de Personal y Servicio
  const [employees, setEmployees] = useState([]);
  const [currentCashier, setCurrentCashier] = useState(1);
  const [availableTables, setAvailableTables] = useState([]);

  // Modo de servicio (Aldelo POS OrderType: 1 = Dine In / Mesa, 2 = Take Out / Llevar, 3 = Delivery / Domicilio)
  const [orderType, setOrderType] = useState(1);
  const [selectedTable, setSelectedTable] = useState(1);
  const [customerInfo, setCustomerInfo] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [showTableSelectorPopover, setShowTableSelectorPopover] = useState(false);

  // Pestaña principal: 'order' (Terminal de Pedidos) o 'pending_payments' (Órdenes por Cobrar)
  const [activeView, setActiveView] = useState('order');

  // Filtro de servicio en lista de órdenes por cobrar ('ALL' | 'TAKE_OUT' | 'DINE_IN')
  const [serviceFilter, setServiceFilter] = useState('ALL');

  // Categoría activa y búsqueda rápida
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Carrito de la comanda
  const [cart, setCart] = useState([]);

  // Modal de modificadores
  const [modifyingItem, setModifyingItem] = useState(null);

  // Estados de cobro y liquidación inmediata
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);

  // Sin productos no hay nada que cobrar: cerrar la sección de método de pago.
  useEffect(() => {
    if (cart.length === 0) {
      setShowPaymentDrawer(false);
      setCashTendered('');
    }
  }, [cart.length]);

  // Modal para completar pago de orden pendiente (Autoservicio o Mesa)
  const [settlingOrder, setSettlingOrder] = useState(null);
  const [settlePayMethod, setSettlePayMethod] = useState('CASH');
  const [settleCashTendered, setSettleCashTendered] = useState('');

  // Reloj nativo estilo iOS
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
      const rawDate = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      const capDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
      setTimeString(time);
      setDateString(capDate);
    };
    updateClock();
    const timer = setInterval(updateClock, 5000);
    return () => clearInterval(timer);
  }, []);

  // Telemetría de batería y conectividad
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      navigator
        .getBattery()
        .then((battery) => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(Boolean(battery.charging));
          const updateBattery = () => {
            setBatteryLevel(Math.round(battery.level * 100));
            setIsCharging(Boolean(battery.charging));
          };
          battery.addEventListener('levelchange', updateBattery);
          battery.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => { });
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar turno de caja actual
  useEffect(() => {
    fetchCurrentCashShift()
      .then((res) => {
        if (res && res.shift) {
          setCashShift(res);
        }
      })
      .catch(() => { });
  }, [showCashShiftModal]);

  // Cargar lista de empleados y mesas
  useEffect(() => {
    fetchEmployees()
      .then((emps) => {
        if (emps && emps.length > 0) {
          setEmployees(emps);
          setCurrentCashier(emps[0].id || 1);
        }
      })
      .catch((err) => console.error('Error fetching employees:', err));

    fetchTables()
      .then((tbls) => {
        if (tbls && tbls.length > 0) {
          setAvailableTables(tbls);
        }
      })
      .catch((err) => console.error('Error fetching tables:', err));

    loadStockStatus();
  }, []);

  const loadStockStatus = () => {
    fetchAdminProducts()
      .then((prods) => setAdminProducts(prods || []))
      .catch((err) => console.error('Error fetching admin products:', err));
  };

  // Platillos con su categoría y estado de disponibilidad en vivo
  const allItems = useMemo(() => {
    const availabilityMap = {};
    adminProducts.forEach((p) => {
      availabilityMap[p.id] = p.isActive;
    });

    const itemsFromCats = categories.flatMap((c) =>
      (c.items || []).map((it) => ({
        ...it,
        categoryName: c.name,
        categoryId: c.id,
        isActive: availabilityMap[it.id] !== undefined ? availabilityMap[it.id] : true
      }))
    );

    const existingIds = new Set(itemsFromCats.map((i) => i.id));
    adminProducts.forEach((ap) => {
      if (!existingIds.has(ap.id)) {
        itemsFromCats.push({
          id: ap.id,
          name: ap.name,
          price: ap.price,
          categoryName: ap.categoryName || 'General',
          categoryId: ap.categoryId,
          description: ap.description || '',
          modifiers: [],
          hasModifiers: false,
          isActive: false
        });
      }
    });

    return itemsFromCats;
  }, [categories, adminProducts]);

  // Cambiar disponibilidad de producto estilo iOS directo
  const handleToggleStockDirect = async (item, e) => {
    if (e) e.stopPropagation();
    const nextState = !item.isActive;
    setTogglingItemId(item.id);
    sfx.playTap();
    try {
      await toggleProductActive(item.id, nextState);
      setAdminProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isActive: nextState } : p))
      );
      if (nextState) {
        sfx.playSuccess();
      } else {
        sfx.playWarning();
      }
    } catch (err) {
      console.error('Error cambiando disponibilidad de producto:', err);
      showAlert({ variant: 'error', title: 'No se pudo cambiar la disponibilidad', description: err.message });
    } finally {
      setTogglingItemId(null);
    }
  };

  // Filtrar platillos por categoría y texto de búsqueda
  const filteredItems = useMemo(() => {
    return allItems.filter((i) => {
      const matchCat = selectedCategory === 'ALL' || i.categoryName === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        String(i.id || '').toLowerCase().includes(q) ||
        (i.categoryName || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCategory, search]);

  // Órdenes que NECESITAN COMPLETAR PAGO (OrderStatus = '1' o isPaid = false)
  const pendingPaymentOrders = useMemo(() => {
    return activeOrders.filter((o) => o.status === '1' || o.isPaid === false);
  }, [activeOrders]);

  // Contadores para filtros
  const takeOutCount = useMemo(() => {
    return pendingPaymentOrders.filter((o) => Number(o.orderType) === 2 || !o.tableId).length;
  }, [pendingPaymentOrders]);

  const dineInCount = useMemo(() => {
    return pendingPaymentOrders.filter((o) => Number(o.orderType) === 1 && !!o.tableId).length;
  }, [pendingPaymentOrders]);

  // Órdenes por cobrar filtradas según selección (Todas / Para Llevar / En Mesa)
  const displayedPendingOrders = useMemo(() => {
    return pendingPaymentOrders.filter((o) => {
      const isTakeOut = Number(o.orderType) === 2 || !o.tableId;
      if (serviceFilter === 'TAKE_OUT') return isTakeOut;
      if (serviceFilter === 'DINE_IN') return !isTakeOut;
      return true;
    });
  }, [pendingPaymentOrders, serviceFilter]);

  // Gestos de Long-Press (Hold por ~1.2 segundos estilo iOS para activar modo Agotados)
  const cancelCardHold = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHoldingItemId(null);
  };

  const handleCardPointerDown = (item, e) => {
    if (e.button && e.button !== 0) return;
    cancelCardHold();
    longPressTriggeredRef.current = false;
    if (isStockJiggleMode) return;

    setHoldingItemId(item.id);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setHoldingItemId(null);
      sfx.playTap();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) { }
      }
      setIsStockJiggleMode(true);
      loadStockStatus();
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Agregar producto al hacer clic en tarjeta (o toggle si está en modo jiggle)
  const handleItemClick = (item) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (isStockJiggleMode) {
      handleToggleStockDirect(item);
      return;
    }

    if (item.isActive === false) {
      sfx.playWarning();
      showAlert({
        variant: 'warning',
        title: `"${item.name}" está agotado`,
        description: 'Mantén presionada cualquier tarjeta por 1 segundo o activa "Agotados" arriba para volver a habilitarlo.',
      });
      return;
    }

    sfx.playTap();
    if (item.modifiers && item.modifiers.length > 0) {
      setModifyingItem(item);
    } else {
      addToCartSimple(item);
    }
  };

  // Agregar producto directo sin modificadores
  const addToCartSimple = (item) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.id === item.id && (!c.modifiers || c.modifiers.length === 0) && !c.notes
      );
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: copy[existingIndex].quantity + 1
        };
        return copy;
      }
      return [
        ...prev,
        {
          cartItemId: `${item.id}-${Date.now()}-${Math.random()}`,
          id: item.id,
          name: item.name,
          categoryName: item.categoryName || '',
          image: item.image || item.imageUrl || '',
          price: Number(item.price) || 0,
          basePrice: Number(item.price) || 0,
          quantity: 1,
          modifiers: [],
          notes: ''
        }
      ];
    });
  };

  // Recibir ítem configurado con modificadores desde ModifierModal
  const handleAddCustomizedItem = (configuredItem) => {
    setCart((prev) => [
      ...prev,
      {
        cartItemId: `${configuredItem.id}-${Date.now()}-${Math.random()}`,
        id: configuredItem.id,
        name: configuredItem.name,
        categoryName: configuredItem.categoryName || modifyingItem?.categoryName || '',
        image: configuredItem.image || configuredItem.imageUrl || modifyingItem?.image || '',
        price: Number(configuredItem.price) || 0,
        basePrice:
          Number(
            configuredItem.basePrice !== undefined ? configuredItem.basePrice : configuredItem.price
          ) || 0,
        quantity: configuredItem.quantity || 1,
        modifiers: configuredItem.modifiers || [],
        notes: configuredItem.notes || ''
      }
    ]);
  };

  // Actualizar cantidad de un ítem del carrito
  const updateQty = (cartItemId, delta) => {
    sfx.playTap();
    setCart((prev) =>
      prev
        .map((c) => (c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  // Eliminar un ítem del carrito
  const removeItem = (cartItemId) => {
    sfx.playTap();
    setCart((prev) => prev.filter((c) => c.cartItemId !== cartItemId));
  };

  // Totales
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCartItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalCOPVal = Math.round(total * 1000);
  const cashNum = parseFloat(cashTendered) || 0;
  const changeCOP = Math.max(0, cashNum - totalCOPVal);

  // 1. Enviar orden a cocina como PENDIENTE (isPaid = false, OrderStatus = 1)
  const handleSendToKitchenPending = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    sfx.playTap();

    try {
      const payload = {
        employeeId: currentCashier,
        orderType,
        tableId: orderType === 1 ? selectedTable : null,
        notes: (orderType === 3 ? `[DOMICILIO: ${customerInfo}] ` : '') + (orderNotes || ''),
        paymentMethod: 'CASH',
        isPaid: false,
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          basePrice: i.basePrice,
          modifiers: i.modifiers || [],
          notes: i.notes || ''
        }))
      };

      const res = await createOrder(payload);
      sfx.playReadyChime();
      setCart([]);
      setOrderNotes('');
      setCustomerInfo('');
      setShowPaymentDrawer(false);
      showAlert({
        variant: 'success',
        title: 'Comanda enviada a cocina',
        description: `Orden #${res.orderNumber || res.id} (${orderType === 1
          ? `Mesa #${selectedTable}`
          : orderType === 2
            ? 'PARA LLEVAR'
            : 'DOMICILIO'
        })`,
      });
    } catch (err) {
      showAlert({ variant: 'error', title: 'No se pudo enviar la orden', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Cobro inmediato y cierre de orden (isPaid = true, OrderStatus = 2)
  const handleSettleImmediateOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    sfx.playTap();

    try {
      const payload = {
        employeeId: currentCashier,
        orderType,
        tableId: orderType === 1 ? selectedTable : null,
        notes: (orderType === 3 ? `[DOMICILIO: ${customerInfo}] ` : '') + (orderNotes || ''),
        paymentMethod,
        isPaid: true,
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          basePrice: i.basePrice,
          modifiers: i.modifiers || [],
          notes: i.notes || ''
        }))
      };

      const res = await createOrder(payload);
      sfx.playReadyChime();
      setCart([]);
      setCashTendered('');
      setOrderNotes('');
      setCustomerInfo('');
      setShowPaymentDrawer(false);
      showAlert({
        variant: 'success',
        title: 'Venta cobrada e impresa',
        description: `Orden #${res.orderNumber || res.id} (${orderType === 1
          ? `Mesa #${selectedTable}`
          : orderType === 2
            ? 'PARA LLEVAR'
            : 'DOMICILIO'
        }) - ${formatCOP(total)}`,
      });
    } catch (err) {
      showAlert({ variant: 'error', title: 'No se pudo registrar el cobro', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Completar pago de una orden pendiente (Autoservicio o Mesa) y ENVIARLA A COCINA
  const handleConfirmSettlePendingOrder = async () => {
    if (!settlingOrder) return;
    setIsSubmitting(true);
    sfx.playTap();

    try {
      await updateOrderStatus(settlingOrder.id, '2');
      sfx.playReadyChime();
      const isTakeOut = Number(settlingOrder.orderType) === 2 || !settlingOrder.tableId;
      showAlert({
        variant: 'success',
        title: 'Pago completado',
        description: `Orden #${settlingOrder.orderNumber || settlingOrder.id} (${isTakeOut ? 'PARA LLEVAR' : `Mesa #${settlingOrder.tableId}`
        }) pagada y enviada a cocina.`,
      });
      setSettlingOrder(null);
      setSettleCashTendered('');
      await refreshActiveOrders();
    } catch (e) {
      showAlert({ variant: 'error', title: 'No se pudo completar el pago', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Anular orden
  const handleVoidOrder = async (orderId) => {
    const confirmed = await showConfirm({
      variant: 'warning',
      title: `¿Anular la orden #${orderId}?`,
      description: 'Esta acción no se puede deshacer.',
      actionLabel: 'Anular orden',
    });
    if (!confirmed) return;
    sfx.playTap();
    try {
      await updateOrderStatus(orderId, '3');
      sfx.playTap();
      await refreshActiveOrders();
      showAlert({ variant: 'success', title: `Orden #${orderId} anulada` });
    } catch (e) {
      showAlert({ variant: 'error', title: 'No se pudo anular la orden', description: e.message });
    }
  };

  // Cargar una orden pendiente al ticket para edición
  const handleLoadPendingOrderToTicket = async (order) => {
    sfx.playTap();
    if (cart.length > 0) {
      const confirmed = await showConfirm({
        variant: 'warning',
        title: `¿Reemplazar el ticket con la orden #${order.id}?`,
        description: 'El ticket actual tiene productos que se perderán.',
        actionLabel: 'Reemplazar',
      });
      if (!confirmed) return;
    }
    setOrderType(Number(order.orderType) || 1);
    if (order.tableId) setSelectedTable(order.tableId);
    setCart(
      (order.items || []).map((i) => ({
        cartItemId: `${i.id}-${Date.now()}-${Math.random()}`,
        id: i.id,
        name: i.name,
        categoryName: i.categoryName || '',
        image: i.image || i.imageUrl || '',
        price: Number(i.price) || 0,
        basePrice: Number(i.basePrice || i.price) || 0,
        quantity: i.quantity || 1,
        modifiers: i.modifiers || [],
        notes: i.notes || ''
      }))
    );
    setActiveView('order');
  };

  const cashierInitial = (
    sessionEmployee?.name ||
    employees.find((e) => e.id === currentCashier)?.name ||
    'A'
  )
    .charAt(0)
    .toUpperCase();

  const shiftNumber = cashShift?.shift?.id || 3;

  return (
    <div className="cpos-shell-root">
      {/* ============================================================== */}
      {/* TOP APP SHELL (Navigation & Categories Header)                 */}
      {/* ============================================================== */}
      <header className="cpos-top-header">
        {/* Top Action Row (Sin barra simulada de iOS de hora/wifi/batería) */}
        <div className="cpos-status-bar">
          <div className="cpos-status-left">
            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                navigate('/');
              }}
              className="ui-btn-back-link"
            >
              <ChevronLeft className="ui-icon-16" />
              <span>Volver al Inicio</span>
            </button>

            <span className="cpos-status-divider">|</span>

            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setShowCashShiftModal(true);
              }}
              className={`ui-pill ui-pill-xs ui-pill-emerald ui-pill-interactive ${isOnline ? 'online' : 'offline'}`}
              title="Clic para abrir Arqueo y Turno de Caja"
            >
              <span className={`ui-dot ui-dot-pulse ${isOnline ? 'online' : 'offline'}`} />
              <span>
                Turno #{shiftNumber} {isOnline ? 'En línea' : 'Sin conexión'}
              </span>
            </button>
          </div>

          <div className="cpos-status-right">
            {/* Controles rápidos de vista y Quick Actions con iconografía estilo KDS */}
            <div className="cpos-status-tools">
              <button
                type="button"
                onClick={() => {
                  sfx.playTap();
                  setActiveView(activeView === 'order' ? 'pending_payments' : 'order');
                }}
                className={`ui-pill-tool ${activeView === 'pending_payments' ? 'active' : ''
                  }`}
                title="Ver órdenes pendientes por cobrar"
              >
                <CreditCard className="ui-icon-14" />
                <span>
                  {activeView === 'pending_payments'
                    ? 'Menú'
                    : `Por Cobrar (${pendingPaymentOrders.length})`}
                </span>
              </button>

              {/* Quick Action: Modo Rápido / Rayo (Amber Accent) */}
              <button
                type="button"
                title={
                  isStockJiggleMode
                    ? 'Salir de Modo Rápido / Agotados Express'
                    : 'Acción Rápida / Modo Express (Agotados)'
                }
                onClick={() => {
                  sfx.playTap();
                  const nextMode = !isStockJiggleMode;
                  setIsStockJiggleMode(nextMode);
                  if (nextMode) loadStockStatus();
                }}
                className={`ui-qa-btn ui-qa-amber ${isStockJiggleMode ? 'is-active' : ''}`}
              >
                <Zap className="ui-icon-14 ui-qa-fill-amber" />
              </button>

              {/* Quick Action: Transmisión / KDS Cast (Emerald Accent) */}
              <button
                type="button"
                title={
                  cart.length > 0
                    ? 'Enviar / Transmitir Comanda Actual a Cocina'
                    : 'Transmitir / Cambiar Vista KDS y Cobros'
                }
                onClick={() => {
                  if (cart.length > 0 && !isSubmitting) {
                    handleSendToKitchenPending();
                  } else {
                    sfx.playTap();
                    setActiveView(activeView === 'order' ? 'pending_payments' : 'order');
                  }
                }}
                className={`ui-qa-btn ui-qa-emerald ${cart.length > 0 ? 'is-active' : ''}`}
              >
                <Cast className="ui-icon-14" />
              </button>

              {/* Quick Action: Brillo / Pantalla */}
              <button
                type="button"
                title="Modo de Brillo"
                onClick={() => toggleKdsTheme()}
                className={`ui-qa-btn ui-qa-surface ${kdsTheme === 'dark' ? 'is-active' : ''}`}
              >
                {kdsTheme === 'dark' ? (
                  <Moon className="ui-icon-14" />
                ) : (
                  <Sun className="ui-icon-14" />
                )}
              </button>

              {/* Quick Action: Pantalla Completa / Enfoque (Rose Accent) */}
              <button
                type="button"
                title={isFullscreen ? 'Salir de Modo Pantalla Completa' : 'Modo Pantalla Completa'}
                aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Modo Pantalla Completa'}
                onClick={handleToggleFullscreen}
                className={`ui-qa-btn ui-qa-rose ${isFullscreen ? 'is-active' : ''}`}
              >
                <Scan className="ui-icon-14" />
              </button>

              {/* Quick Action: Sincronizar / Refrescar */}
              <button
                type="button"
                title="Sincronizar Pedidos"
                onClick={handleSyncOrders}
                className={`ui-qa-btn ui-qa-surface ${isSyncing ? 'is-active' : ''}`}
              >
                <RefreshCw className={`ui-icon-14 ${isSyncing ? 'ui-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Subheader with Expandable Search & Categories bar */}
        <div className="cpos-subheader">
          {/* Search Input (Collapsed Icon -> Expandable iOS Search Bar on Click) */}
          <div
            className={`cpos-search-wrap ${
              isSearchExpanded || Boolean(search) ? 'is-expanded' : 'is-collapsed'
            }`}
          >
            {!(isSearchExpanded || Boolean(search)) ? (
              <button
                type="button"
                onClick={() => {
                  sfx.playTap();
                  setIsSearchExpanded(true);
                  setTimeout(() => searchInputRef.current?.focus(), 20);
                }}
                className="cpos-search-trigger-btn"
                title="Buscar platillo o código"
                aria-label="Abrir buscador de platillos"
              >
                <Search className="cpos-search-trigger-icon" />
              </button>
            ) : (
              <>
                <Search className="cpos-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar platillo o código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => {
                    if (!search.trim()) {
                      setIsSearchExpanded(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearch('');
                      setIsSearchExpanded(false);
                      e.currentTarget.blur();
                    }
                  }}
                  className="cpos-search-input"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    sfx.playTap();
                    if (search) {
                      setSearch('');
                      searchInputRef.current?.focus();
                    } else {
                      setIsSearchExpanded(false);
                    }
                  }}
                  className="cpos-search-clear"
                  title={search ? 'Limpiar búsqueda' : 'Cerrar buscador'}
                  aria-label={search ? 'Limpiar búsqueda' : 'Cerrar buscador'}
                >
                  ✕
                </button>
              </>
            )}
          </div>

          {/* Categories Pills (Segmented Filter Style) */}
          <div className="cpos-cats-bar">
            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setSelectedCategory('ALL');
                if (activeView !== 'order') setActiveView('order');
              }}
              className={`ui-pill-cat ${selectedCategory === 'ALL' ? 'is-active' : ''}`}
            >
              <Flame className="cpos-flame-icon" />
              <span>TODOS ({allItems.length})</span>
            </button>

            {categories.map((cat) => {
              const isCatSelected = selectedCategory === cat.name;
              const count = (cat.items || []).length;
              return (
                <button
                  key={cat.id || cat.name}
                  type="button"
                  onClick={() => {
                    sfx.playTap();
                    setSelectedCategory(cat.name);
                    if (activeView !== 'order') setActiveView('order');
                  }}
                  className={`ui-pill-cat ${isCatSelected ? 'is-active' : ''}`}
                >
                  <span>
                    {cat.name} ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* User & Table Chip */}
          <div className="cpos-user-chip-container">
            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setShowTableSelectorPopover((prev) => !prev);
              }}
              className="ui-pill ui-pill-md ui-pill-surface ui-pill-interactive"
              title="Clic para cambiar Mesa o Tipo de Servicio"
            >
              <div className="ui-avatar-sm">{cashierInitial}</div>
              <span className="ui-label-md ui-text-surface">
                {orderType === 1
                  ? `Mesa #${selectedTable}`
                  : orderType === 2
                    ? 'Para Llevar'
                    : 'Domicilio'}
              </span>
            </button>

            {showTableSelectorPopover && (
              <div className="cpos-service-popover">
                <div className="cpos-service-popover-title">Tipo de Servicio</div>
                <div className="cpos-service-popover-tabs">
                  {[
                    { id: 1, label: 'Mesa' },
                    { id: 2, label: 'Llevar' },
                    { id: 3, label: 'Domicilio' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setOrderType(t.id);
                      }}
                      className={`cpos-service-popover-tab ${orderType === t.id ? 'active' : ''}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {orderType === 1 && (
                  <div className="cpos-service-popover-field">
                    <label className="cpos-service-popover-label">Número de Mesa:</label>
                    <div className="cpos-table-quick-grid">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            sfx.playTap();
                            setSelectedTable(num);
                            setShowTableSelectorPopover(false);
                          }}
                          className={`cpos-table-quick-btn ${selectedTable === num ? 'active' : ''
                            }`}
                        >
                          #{num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {orderType === 3 && (
                  <div className="cpos-service-popover-field">
                    <label className="cpos-service-popover-label">Cliente / Dirección:</label>
                    <input
                      type="text"
                      placeholder="Nombre, Tel, Dirección"
                      value={customerInfo}
                      onChange={(e) => setCustomerInfo(e.target.value)}
                      className="cpos-service-popover-input"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowTableSelectorPopover(false)}
                  className="cpos-service-popover-close"
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* WORKSPACE BODY: 2 Columns Split (Catalog & Active Ticket)      */}
      {/* ============================================================== */}
      {activeView === 'order' ? (
        <div className="cpos-workspace">
          {/* LEFT COLUMN (60-70%): Product Catalog Grid with Images */}
          <main className="cpos-catalog-main">
            {/* REDESIGNED: Banner Modo Edición de Stock Activo (Clean Light iOS Card Design) */}
            {isStockJiggleMode && (
              <div className="cpos-stock-banner">
                {/* Ambient subtle glow in the background */}
                <div className="cpos-stock-banner-glow" />

                {/* Left status info with Lucide iconography */}
                <div className="cpos-stock-banner-left">
                  <div className="ui-icon-box ui-icon-box-lg">
                    <Boxes className="ui-icon-20" />
                  </div>
                  <div>
                    <div className="cpos-stock-banner-title-row">
                      <h2 className="ui-title-md cpos-stock-banner-title">Modo Edición de Stock</h2>
                      <span className="ui-pill ui-pill-xs ui-pill-emerald ui-pill-upper">
                        <span className="ui-dot ui-dot-pulse" />
                        <span>Activo</span>
                      </span>
                    </div>
                    <p className="ui-label-sm ui-text-muted cpos-stock-banner-desc">
                      Toca el badge de cualquier platillo para alternar entre{' '}
                      <span className="cpos-stock-text-active">Activo</span> o{' '}
                      <span className="cpos-stock-text-soldout">Agotado</span> en tiempo real.
                    </p>
                  </div>
                </div>

                {/* Right action button: "Listo (Terminar)" Redesigned with iOS Pill & Lucide icon */}
                <button
                  type="button"
                  onClick={() => {
                    sfx.playTap();
                    setIsStockJiggleMode(false);
                  }}
                  className="ui-btn ui-btn-primary ui-btn-sm cpos-stock-banner-btn"
                >
                  <CheckCheck className="ui-icon-16" />
                  <span>Listo (Terminar)</span>
                </button>
              </div>
            )}

            <div className="cpos-catalog-grid">
              {filteredItems.map((item, idx) => {
                const hasModifiers = Boolean(item.modifiers && item.modifiers.length > 0);
                const inCartQty = cart
                  .filter((c) => c.id === item.id)
                  .reduce((sum, c) => sum + c.quantity, 0);
                const isItemInactive = item.isActive === false;
                const isToggling = togglingItemId === item.id;
                const isSelected = inCartQty > 0 && !isItemInactive;
                const imgSrc = getPosProductImage(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    onPointerDown={(e) => handleCardPointerDown(item, e)}
                    onPointerUp={cancelCardHold}
                    onPointerLeave={cancelCardHold}
                    onPointerCancel={cancelCardHold}
                    onTouchMove={cancelCardHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className={[
                      'cpos-prod-card',
                      isSelected ? 'is-selected' : '',
                      isItemInactive ? 'is-inactive' : '',
                      holdingItemId === item.id ? 'is-holding' : '',
                      isStockJiggleMode ? (idx % 2 === 0 ? 'jiggle-even' : 'jiggle-odd') : '',
                      isToggling ? 'is-toggling' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {/* Botón / Badge estilo iOS de Disponibilidad */}
                    {isStockJiggleMode ? (
                      <button
                        type="button"
                        onClick={(e) => handleToggleStockDirect(item, e)}
                        title="Clic para cambiar disponibilidad"
                        className={`ui-badge-jiggle ${isItemInactive ? 'inactive' : 'active'
                          }`}
                      >
                        <span className="ui-dot white" />
                        <span>{isItemInactive ? 'Agotado' : 'Activo'}</span>
                      </button>
                    ) : (
                      isItemInactive && (
                        <div className="ui-badge-soldout">AGOTADO (86)</div>
                      )
                    )}

                    {/* Active Badge Counter when in cart */}
                    {!isStockJiggleMode && isSelected && (
                      <div className="ui-badge-qty">{inCartQty}</div>
                    )}

                    {/* Product Image Header */}
                    <div className="cpos-prod-media">
                      <img
                        src={imgSrc}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getProductImageUrl(item, item.categoryName);
                        }}
                        className="cpos-prod-img"
                      />
                      <span
                        className={`ui-tag-glass ${isSelected ? 'is-selected' : ''}`}
                      >
                        {item.categoryName}
                      </span>
                    </div>

                    {/* Product Body */}
                    <div className="cpos-prod-body">
                      <h3 className={`cpos-prod-title ${isSelected ? 'is-selected' : ''}`}>
                        {item.name}
                      </h3>

                      <div className="cpos-prod-footer">
                        <span
                          className={`cpos-prod-price ${isSelected ? 'is-selected' : ''}`}
                        >
                          {formatCOP(item.price)}
                        </span>

                        {hasModifiers ? (
                          <span className="ui-pill ui-pill-xs ui-pill-amber">
                            <Sparkles className="cpos-prod-mods-icon" />
                            <span>Mods</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label="Ajustes de platillo"
                            onClick={(e) => {
                              e.stopPropagation();
                              sfx.playTap();
                              setModifyingItem(item);
                            }}
                            className={`ui-btn-circle-sm ${isSelected ? 'is-selected' : ''
                              }`}
                          >
                            <SlidersHorizontal className="ui-icon-14" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="cpos-catalog-empty">
                  <div className="cpos-catalog-empty-icon">🔍</div>
                  <div className="cpos-catalog-empty-title">No se encontraron platillos</div>
                  <div className="cpos-catalog-empty-sub">
                    Prueba con otro término de búsqueda o selecciona otra categoría.
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* RIGHT COLUMN (30-40%): Command & Order Ticket Panel (iOS Inset Sheet with Thumbnail) */}
          <aside className="cpos-ticket-aside">
            {/* Order Header & Items */}
            <div className="cpos-ticket-top-section">


              {/* Order Items List with Miniature Food Thumbnail */}
              <div className="cpos-ticket-items-scroll">
                {cart.map((item) => {
                  const itemTotal = item.price * item.quantity;
                  const thumbSrc = getPosProductImage(item);

                  return (
                    <div key={item.cartItemId} className="cpos-ticket-item-card">
                      <div className="cpos-ticket-item-row">
                        {/* Item Thumbnail */}
                        <img
                          src={thumbSrc}
                          alt={`Miniatura ${item.name}`}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getProductImageUrl(item, item.categoryName);
                          }}
                          className="cpos-ticket-item-thumb"
                        />

                        <div className="cpos-ticket-item-info">
                          <h4 className="cpos-ticket-item-name ui-truncate">{item.name}</h4>
                          <span className="cpos-ticket-item-price ui-tabular">
                            {formatCOP(item.price)}
                          </span>
                        </div>

                        {/* Quantity Stepper (iOS Style Pill) */}
                        <div className="ui-qty-stepper">
                          <button
                            type="button"
                            aria-label="Disminuir"
                            onClick={() => updateQty(item.cartItemId, -1)}
                            className="ui-qty-btn minus"
                          >
                            <Minus className="ui-icon-14" />
                          </button>
                          <span className="ui-qty-num ui-tabular">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Aumentar"
                            onClick={() => updateQty(item.cartItemId, 1)}
                            className="ui-qty-btn plus"
                          >
                            <Plus className="ui-icon-14" />
                          </button>
                        </div>

                        {/* Delete action */}
                        <button
                          type="button"
                          aria-label="Eliminar platillo"
                          onClick={() => removeItem(item.cartItemId)}
                          className="ui-btn-delete-icon"
                        >
                          <Trash2 className="ui-icon-16" />
                        </button>
                      </div>

                      {/* Modifiers & preparation notes if present */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="cpos-ticket-item-mods">
                          {item.modifiers.map((m) => (
                            <div key={m.id || m.name} className="cpos-ticket-item-mod-line">
                              + {m.name} {m.price > 0 ? `(${formatCOP(m.price)})` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.notes && <div className="cpos-ticket-item-note-line">📝 {item.notes}</div>}

                      {/* Item subtotal line 
                      <div className="cpos-ticket-item-subrow">
                        <span className="cpos-ticket-item-sublabel">Subtotal ítem</span>
                        <span className="cpos-ticket-item-subval">
                          {formatCOP(itemTotal)}
                        </span>
                      </div>*/}
                    </div>
                  );
                })}

                {cart.length === 0 && (
                  <div className="ui-empty-dashed">
                    <p className="cpos-ticket-empty-title">Sin platillos en la comanda</p>
                    <p className="cpos-ticket-empty-sub">
                      Selecciona productos del catálogo para agregarlos a la cuenta.
                    </p>
                  </div>
                )}
              </div>

              {/* Kitchen Note Field */}
              <div className="cpos-kitchen-note-group">
                <label className="cpos-kitchen-note-label">
                  <MessageSquare className="ui-icon-14" />
                  <span>Observación general para cocina:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sin cebolla, término medio..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="cpos-kitchen-note-input"
                />
              </div>
            </div>

            {/* Order Total & Primary Settlement Actions (The 10% Accent Power Area) */}
            <div className="cpos-ticket-bottom-section">
              {/* Summary Math */}
              <div className="cpos-summary-math">
                <div className="cpos-summary-line">
                  <span>Subtotal</span>
                  <span className="cpos-summary-num ui-tabular">{formatCOP(total)}</span>
                </div>
                <div className="cpos-summary-line">
                  <span>Impuestos (0%)</span>
                  <span className="cpos-summary-num ui-tabular">$0</span>
                </div>
                <div className="cpos-summary-total-row">
                  <span className="cpos-summary-total-label">TOTAL</span>
                  <span className="ui-pill ui-pill-sm ui-pill-neutral">
                    {totalCartItems} {totalCartItems === 1 ? 'ítem' : 'ítems'}
                  </span>
                  <span className="cpos-summary-total-val ui-tabular">{formatCOP(total)}</span>
                </div>
              </div>

              {/* PAYMENT METHODS & CASH CALCULATOR SECTION (MÉTODO DE PAGO INTEGRADO) */}
              {showPaymentDrawer ? (
                <div className="cpos-pay-integrated">
                  {/* Payment Mode Selector Header */}
                  <div className="cpos-pay-header">
                    <span className="cpos-pay-header-title">Método de Pago:</span>
                    <button
                      type="button"
                      onClick={() => setShowPaymentDrawer(false)}
                      className="ui-btn-text-cancel"
                    >
                      <X className="ui-icon-12" />
                      <span>Cancelar</span>
                    </button>
                  </div>

                  {/* Segmented Payment Tabs (Efectivo / Datáfono / QR) */}
                  <div className="cpos-pay-tabs-grid">
                    {/* Tab 1: Efectivo */}
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setPaymentMethod('CASH');
                      }}
                      className={`ui-pill-pay-tab ${paymentMethod === 'CASH' ? 'is-active' : ''}`}
                    >
                      <Banknote className="cpos-pay-icon-cash" />
                      <span>Efectivo</span>
                    </button>

                    {/* Tab 2: Datáfono */}
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setPaymentMethod('CARD');
                      }}
                      className={`ui-pill-pay-tab ${paymentMethod === 'CARD' ? 'is-active' : ''}`}
                    >
                      <CreditCard className="cpos-pay-icon-card" />
                      <span>Datáfono</span>
                    </button>

                    {/* Tab 3: QR / Transferencia */}
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setPaymentMethod('WOMPI_QR');
                      }}
                      className={`ui-pill-pay-tab ${paymentMethod === 'WOMPI_QR' ? 'is-active' : ''
                        }`}
                    >
                      <QrCode className="cpos-pay-icon-qr" />
                      <span>QR</span>
                    </button>
                  </div>

                  {paymentMethod === 'CASH' && (
                    <>
                      {/* Tendered Amount Display */}
                      <div className="cpos-pay-tendered-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Monto entregado"
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          className="cpos-pay-tendered-input ui-tabular"
                        />
                      </div>

                      {/* Quick Cash Denomination Chips */}
                      <div className="cpos-pay-denoms-grid">
                        {[
                          { label: 'Exacto', val: totalCOPVal },
                          { label: '$20k', val: 20000 },
                          { label: '$50k', val: 50000 },
                          { label: '$100k', val: 100000 }
                        ].map((den) => (
                          <button
                            key={den.label}
                            type="button"
                            onClick={() => {
                              sfx.playTap();
                              setCashTendered(String(den.val));
                            }}
                            className="ui-pill-chip"
                          >
                            {den.label}
                          </button>
                        ))}
                      </div>

                      {/* Change Calculation (Cambio) */}
                      <div className="cpos-pay-change-row">
                        <span className="cpos-pay-change-label">Cambio:</span>
                        <span
                          className={`cpos-pay-change-val ui-tabular ${cashNum > 0 && cashNum < totalCOPVal ? 'is-under' : ''
                            }`}
                        >
                          {cashNum > 0 && cashNum < totalCOPVal
                            ? 'Monto menor al total'
                            : `$${changeCOP.toLocaleString('es-CO')}`}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Final Confirm Settlement Button */}
                  <button
                    type="button"
                    data-component-id="button-primary"
                    data-component-type="button"
                    data-component-variant="primary"
                    disabled={
                      isSubmitting ||
                      (paymentMethod === 'CASH' && cashNum > 0 && cashNum < totalCOPVal)
                    }
                    onClick={handleSettleImmediateOrder}
                    className="ui-btn ui-btn-primary ui-btn-md ui-btn-block cpos-pay-confirm-btn"
                  >
                    <CheckCircle2 className="ui-icon-20" />
                    <span>{isSubmitting ? 'Registrando...' : 'Confirmar Cobro y Cerrar'}</span>
                  </button>
                </div>
              ) : (
                <div className="cpos-settlement-grid">
                  {/* Button 1: Enviar a Cocina (Secondary Action / Cuenta Pendiente) */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={handleSendToKitchenPending}
                    className="ui-btn-stack ui-btn-stack-secondary"
                  >
                    <div className="ui-btn-stack-row">
                      <ChefHat className="ui-icon-16" />
                      <span className="ui-btn-stack-title">Enviar a Cocina</span>
                    </div>
                    <span className="ui-btn-stack-sub">Cuenta Pendiente</span>
                  </button>

                  {/* Button 2: Cobrar Inmediato (10% Accent Primary Hero) */}
                  <button
                    type="button"
                    data-component-id="button-primary"
                    data-component-type="button"
                    data-component-variant="primary"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={() => {
                      sfx.playTap();
                      setShowPaymentDrawer(true);
                      setCashTendered(String(totalCOPVal));
                    }}
                    className="ui-btn-stack ui-btn-stack-primary"
                  >
                    <div className="ui-btn-stack-row">
                      <CreditCard className="ui-icon-16" />
                      <span className="ui-btn-stack-title">Cobrar Inmediato</span>
                    </div>
                    <span className="ui-btn-stack-sub">Cerrar Venta</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* ============================================================== */
        /* 3. VISTA DE ÓRDENES QUE NECESITAN COMPLETAR PAGO               */
        /* ============================================================== */
        <div className="cpos-po-viewport">
          <div className="cpos-po-container">
            {/* Title Section & Segmented Filter Bar */}
            <div className="cpos-po-header-bar">
              <div>
                <div className="cpos-po-header-title-row">
                  <div className="ui-icon-box ui-icon-box-sm">
                    <CreditCard className="ui-icon-20" />
                  </div>
                  <h1 className="ui-heading-lg cpos-po-header-title">
                    Órdenes Pendientes de Pago{' '}
                    <span className="ui-text-accent">({pendingPaymentOrders.length})</span>
                  </h1>
                </div>
              </div>

              {/* iOS Segmented Control Capsule (Todas / Para Llevar / En Mesa) */}
              <div className="ui-capsule cpos-po-filter-capsule">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playTap();
                    setServiceFilter('ALL');
                  }}
                  className={`ui-capsule-btn cpos-po-filter-btn ${serviceFilter === 'ALL' ? 'is-active' : ''}`}
                >
                  <ClipboardList className="ui-icon-16 ui-text-accent" />
                  <span>Todas ({pendingPaymentOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playTap();
                    setServiceFilter('TAKE_OUT');
                  }}
                  className={`ui-capsule-btn cpos-po-filter-btn ${serviceFilter === 'TAKE_OUT' ? 'is-active' : ''
                    }`}
                >
                  <ShoppingBag className="ui-icon-16" />
                  <span>Para Llevar ({takeOutCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playTap();
                    setServiceFilter('DINE_IN');
                  }}
                  className={`ui-capsule-btn cpos-po-filter-btn ${serviceFilter === 'DINE_IN' ? 'is-active' : ''
                    }`}
                >
                  <Utensils className="ui-icon-16 cpos-po-filter-icon-mesa" />
                  <span>En Mesa ({dineInCount})</span>
                </button>
              </div>
            </div>

            {displayedPendingOrders.length === 0 ? (
              <div className="ui-empty-card">
                <div className="ui-empty-glow" />

                <div className="ui-empty-icon-wrap">
                  {serviceFilter === 'TAKE_OUT' ? (
                    <ShoppingBag className="ui-icon-32" />
                  ) : serviceFilter === 'DINE_IN' ? (
                    <Utensils className="ui-icon-32" />
                  ) : (
                    <CheckCircle2 className="ui-icon-32" />
                  )}
                  <span className="ui-empty-check-badge">
                    <CheckCheck className="ui-icon-14" />
                  </span>
                </div>

                <span className="ui-pill ui-pill-sm ui-pill-emerald ui-pill-upper">
                  <span className="ui-dot ui-dot-pulse" />
                  <span>Caja al día</span>
                </span>

                <h2 className="ui-heading-md">
                  {serviceFilter === 'ALL'
                    ? '¡No hay órdenes pendientes de pago!'
                    : serviceFilter === 'TAKE_OUT'
                      ? 'No hay órdenes Para Llevar pendientes'
                      : 'No hay órdenes en Mesa pendientes'}
                </h2>

                <p className="ui-body-md ui-text-muted ui-empty-desc">
                  Todos los pedidos han sido pagados y están en preparación.
                </p>

                <div className="ui-empty-actions">
                  {serviceFilter !== 'ALL' && pendingPaymentOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playTap();
                        setServiceFilter('ALL');
                      }}
                      className="ui-btn ui-btn-secondary ui-btn-md"
                    >
                      <ClipboardList className="ui-icon-16" />
                      <span>Ver todas ({pendingPaymentOrders.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playTap();
                      setActiveView('order');
                    }}
                    className="ui-btn ui-btn-primary ui-btn-md"
                  >
                    <Plus className="ui-icon-16" />
                    <span>Nueva Comanda</span>
                  </button>
                </div>
              </div>
            ) : (
              /* PENDING ORDERS GRID (iOS Cards with Crisp Shadows & Borders) */
              <div className="cpos-po-grid">
                {displayedPendingOrders.map((order) => {
                  const elapsed = getElapsedMinutes(order.createdAt);
                  const isTakeOut = Number(order.orderType) === 2 || !order.tableId;

                  return (
                    <div key={order.id} className="cpos-po-card">
                      <div>
                        {/* Card Top Bar: Table Badge & Timer */}
                        <div className="cpos-po-topbar">
                          {isTakeOut ? (
                            <span className="ui-pill ui-pill-md ui-pill-amber">
                              <ShoppingBag className="ui-icon-16" />
                              <span>PARA LLEVAR</span>
                            </span>
                          ) : (
                            <span className="ui-pill ui-pill-md ui-pill-blue">
                              <Utensils className="ui-icon-16" />
                              <span>MESA #{order.tableId || 'S/M'}</span>
                            </span>
                          )}

                          <div className="ui-pill ui-pill-sm ui-pill-neutral">
                            <Timer className="cpos-po-timer-icon" />
                            <span>{elapsed} min</span>
                          </div>
                        </div>

                        {/* Order Identity & Status Tag */}
                        <div className="cpos-po-identity-row">
                          <h2 className="ui-heading-lg cpos-po-turn-title">
                            Turno #{order.orderNumber || order.id}
                          </h2>

                          <span className="ui-pill ui-pill-xs ui-pill-rose ui-pill-upper">
                            <Hourglass className="cpos-po-hourglass-icon" />
                            <span>POR COBRAR</span>
                          </span>
                        </div>

                        {/* Order Line Items List */}
                        <div className="cpos-po-items-box">
                          {(order.items || []).map((it, idx) => (
                            <div key={idx} className="cpos-po-item-row">
                              <span className="cpos-po-item-name">
                                <strong className="cpos-po-item-qty">{it.quantity || 1}x</strong>{' '}
                                {it.name}
                              </span>
                              <span className="cpos-po-item-price ui-tabular">
                                {formatCOP(it.price * (it.quantity || 1))}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total Amount Line */}
                        <div className="cpos-po-total-row">
                          <span className="ui-title-md cpos-po-total-label">Total a Cobrar:</span>
                          <span className="ui-price-lg cpos-po-total-val">{formatCOP(order.total)}</span>
                        </div>
                      </div>

                      {/* PERFECTLY ALIGNED ACTION TOOLBAR (Grid-based 3-action row) */}
                      <div className="cpos-po-actions">
                        {/* Button 1: Completar Pago (Main Hero Button - 6 cols) */}
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playTap();
                            setSettlingOrder(order);
                            setSettleCashTendered(String(Math.round(order.total * 1000)));
                          }}
                          className="ui-btn ui-btn-primary ui-btn-lg cpos-po-btn-pay"
                        >
                          <Wallet className="ui-icon-16" />
                          <span className="ui-truncate cpos-po-btn-pay-text">Completar</span>
                        </button>

                        {/* Button 2: Editar (Secondary - 4 cols) */}
                        <button
                          type="button"
                          title="Editar pedido en el terminal"
                          onClick={() => handleLoadPendingOrderToTicket(order)}
                          className="ui-btn ui-btn-secondary ui-btn-lg cpos-po-btn-load"
                        >
                          <Pencil className="ui-icon-14 ui-text-muted" />
                          <span>Editar</span>
                        </button>

                        {/* Button 3: Anular / Eliminar (Destructive - 2 cols) */}
                        <button
                          type="button"
                          title="Cancelar comanda"
                          onClick={() => handleVoidOrder(order.id)}
                          className="ui-btn ui-btn-danger-soft ui-btn-lg cpos-po-btn-void"
                        >
                          <Trash2 className="ui-icon-16" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL DE MODIFICADORES                                       */}
      {/* ============================================================== */}
      {modifyingItem && (
        <ModifierModal
          item={modifyingItem}
          categoryName={modifyingItem.categoryName}
          isOpen={Boolean(modifyingItem)}
          onClose={() => setModifyingItem(null)}
          onAdd={(customizedItem) => {
            handleAddCustomizedItem(customizedItem);
            setModifyingItem(null);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* 5. MODAL DE COMPLETAR PAGO Y ENVIAR A COCINA                    */}
      {/* ============================================================== */}
      <SettlePaymentModal
        settlingOrder={settlingOrder}
        settlePayMethod={settlePayMethod}
        settlePayMethodChange={setSettlePayMethod}
        setSettlePayMethod={setSettlePayMethod}
        settleCashTendered={settleCashTendered}
        setSettleCashTendered={setSettleCashTendered}
        isSubmitting={isSubmitting}
        onClose={() => setSettlingOrder(null)}
        onConfirm={handleConfirmSettlePendingOrder}
      />

      {/* Modal de Turno de Caja (Apertura, Arqueo Z y Cierre) */}
      <CashShiftModal
        isOpen={showCashShiftModal}
        onClose={() => setShowCashShiftModal(false)}
      />

      {/* Modal de Disponibilidad de Productos (Agotados / 86'd) */}
      <ProductAvailabilityModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
      />
    </div>
  );
}
