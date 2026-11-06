import React, { useState, useEffect, useMemo } from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { useKdsStore } from '../../store/useKdsStore';
import { fetchEmployees, createOrder, updateOrderStatus, fetchTables, fetchAdminProducts, toggleProductActive } from '../../api';
import { formatCOP, getElapsedMinutes, formatRegularTime } from '../../utils/format';
import { sfx } from '../../utils/audio';
import { ModifierModal } from '../kiosk/ModifierModal';
import { CashShiftModal } from './CashShiftModal';
import { SettlePaymentModal } from './SettlePaymentModal';
import { ProductAvailabilityModal } from '../admin/ProductAvailabilityModal';
import './CashierView.css';

export function CashierView() {
  const categories = useMenuStore((state) => state.categories);
  const activeOrders = useKdsStore((state) => state.activeOrders);

  // Modales de Turno de Caja y Agotados
  const [showCashShiftModal, setShowCashShiftModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  // Modo iOS Shaking / Wiggle para Agotados en directo
  const [isStockJiggleMode, setIsStockJiggleMode] = useState(false);
  const [adminProducts, setAdminProducts] = useState([]);
  const [togglingItemId, setTogglingItemId] = useState(null);

  // Estados de Personal y Servicio
  const [employees, setEmployees] = useState([]);
  const [currentCashier, setCurrentCashier] = useState(1);
  const [availableTables, setAvailableTables] = useState([]);

  // Modo de servicio (Aldelo POS OrderType: 1 = Dine In / Mesa, 2 = Take Out / Llevar, 3 = Delivery / Domicilio)
  const [orderType, setOrderType] = useState(1);
  const [selectedTable, setSelectedTable] = useState(1);
  const [customerInfo, setCustomerInfo] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Pestaña principal: 'order' (Rapid Order) o 'pending_payments' (Órdenes por Cobrar)
  const [activeView, setActiveView] = useState('order');

  // Filtro de servicio en lista de órdenes por cobrar ('ALL' | 'TAKE_OUT' | 'DINE_IN')
  const [serviceFilter, setServiceFilter] = useState('ALL');

  // Categoría activa y búsqueda rápida
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');

  // Carrito de la comanda
  const [cart, setCart] = useState([]);

  // Modal de modificadores
  const [modifyingItem, setModifyingItem] = useState(null);

  // Estados de cobro y liquidación inmediata
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);

  // Modal para completar pago de orden pendiente (Autoservicio o Mesa)
  const [settlingOrder, setSettlingOrder] = useState(null);
  const [settlePayMethod, setSettlePayMethod] = useState('CASH');
  const [settleCashTendered, setSettleCashTendered] = useState('');

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

    // Integrar productos desactivados que no vienen en el getMenu() normal para que aparezcan en caja
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
      alert('Error: ' + err.message);
    } finally {
      setTogglingItemId(null);
    }
  };

  // Filtrar platillos por categoría y texto de búsqueda
  const filteredItems = useMemo(() => {
    return allItems.filter((i) => {
      const matchCat = selectedCategory === 'ALL' || i.categoryName === selectedCategory;
      const matchSearch = !search.trim() || i.name.toLowerCase().includes(search.toLowerCase());
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

  // Agregar producto al hacer clic en tarjeta (o toggle si está en modo jiggle)
  const handleItemClick = (item) => {
    // Si estamos en modo de edición de stock (estilo iOS), hacer toggle directo
    if (isStockJiggleMode) {
      handleToggleStockDirect(item);
      return;
    }

    // Si el producto está agotado y no estamos en modo edición, bloquear y avisar
    if (item.isActive === false) {
      sfx.playWarning();
      alert(`⚠️ "${item.name}" está marcado como AGOTADO (86'd).\nActiva el "Modo Agotados (iOS)" arriba para volver a habilitarlo.`);
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
        price: Number(configuredItem.price) || 0,
        basePrice: Number(configuredItem.basePrice !== undefined ? configuredItem.basePrice : configuredItem.price) || 0,
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
        isPaid: false, // Orden pendiente de pago
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
      alert(`¡Comanda enviada a Cocina!\nOrden #${res.orderNumber || res.id} (${orderType === 1 ? `Mesa #${selectedTable}` : orderType === 2 ? 'PARA LLEVAR' : 'DOMICILIO'})`);
    } catch (err) {
      alert('Error enviando orden: ' + err.message);
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
        isPaid: true, // Orden cobrada y cerrada
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
      alert(`¡Venta cobrada e impresa con éxito!\nOrden #${res.orderNumber || res.id} (${orderType === 1 ? `Mesa #${selectedTable}` : orderType === 2 ? 'PARA LLEVAR' : 'DOMICILIO'}) - ${formatCOP(total)}`);
    } catch (err) {
      alert('Error al registrar cobro: ' + err.message);
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
      alert(`¡Pago completado con éxito!\nOrden #${settlingOrder.orderNumber || settlingOrder.id} (${isTakeOut ? 'PARA LLEVAR' : `Mesa #${settlingOrder.tableId}`}) PAGADA y enviada a cocina.`);
      setSettlingOrder(null);
      setSettleCashTendered('');
    } catch (e) {
      alert('Error completando pago: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Anular orden
  const handleVoidOrder = async (orderId) => {
    if (!confirm(`¿Está seguro de anular la orden #${orderId}? Esta acción es irreversible.`)) return;
    sfx.playTap();
    try {
      await updateOrderStatus(orderId, '3');
      sfx.playTap();
      alert(`Orden #${orderId} anulada.`);
    } catch (e) {
      alert('Error anulando orden: ' + e.message);
    }
  };

  // Cargar una orden pendiente al ticket para edición
  const handleLoadPendingOrderToTicket = (order) => {
    sfx.playTap();
    if (cart.length > 0) {
      if (!confirm('El ticket actual tiene productos. ¿Deseas reemplazarlos con la orden #' + order.id + '?')) {
        return;
      }
    }
    setOrderType(Number(order.orderType) || 1);
    if (order.tableId) setSelectedTable(order.tableId);
    setCart(
      (order.items || []).map((i) => ({
        cartItemId: `${i.id}-${Date.now()}-${Math.random()}`,
        id: i.id,
        name: i.name,
        price: Number(i.price) || 0,
        basePrice: Number(i.basePrice || i.price) || 0,
        quantity: i.quantity || 1,
        modifiers: i.modifiers || [],
        notes: i.notes || ''
      }))
    );
    setActiveView('order');
  };

  return (
    <div className="cpos-s-1">
      
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DE RAPID ORDER (ESTILO ALDELO POS)           */}
      {/* ============================================================== */}
      <div
        className="cpos-s-2"
      >
        {/* Lado Izquierdo: Selector de Cajero y Pestañas de Vista */}
        <div className="cpos-s-3">
          {/* Selector de Cajero */}
          <div className="cpos-s-4">
            <span className="cpos-s-5">👤 Cajero:</span>
            <select
              value={currentCashier}
              onChange={(e) => setCurrentCashier(Number(e.target.value))}
              className="cpos-s-6"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
              {employees.length === 0 && <option value={1}>Cajero Principal</option>}
            </select>
          </div>

          <div className="cpos-s-7" />

          {/* Selector de Vista: Nueva Comanda vs Órdenes por Cobrar */}
          <div className="cpos-s-8">
            <button
              type="button"
              onClick={() => { sfx.playTap(); setActiveView('order'); }}
              className={`cpos-view-tab order ${activeView === 'order' ? 'active' : ''}`}
            >
              <span>⚡ Rapid Order</span>
            </button>
            <button
              type="button"
              onClick={() => { sfx.playTap(); setActiveView('pending_payments'); }}
              className={`cpos-view-tab pending ${activeView === 'pending_payments' ? 'active' : ''}`}
            >
              <span>💳 Por Cobrar ({pendingPaymentOrders.length})</span>
              {pendingPaymentOrders.length > 0 && (
                <span className={`cpos-view-badge ${activeView === 'pending_payments' ? 'active' : ''}`}>
                  {pendingPaymentOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Lado Central: Selector de Tipo de Servicio (Order Type) */}
        {activeView === 'order' && (
          <div className="cpos-s-9">
            <span className="cpos-s-10">Servicio:</span>
            <div className="cpos-s-11">
              {[
                { id: 1, label: '🍽️ Mesa' },
                { id: 2, label: '🥡 Para Llevar' },
                { id: 3, label: '🛵 Domicilio' }
              ].map((t) => {
                const isSelected = orderType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { sfx.playTap(); setOrderType(t.id); }}
                    className={`cpos-service-type-btn type-${t.id} ${isSelected ? 'selected' : ''}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Selector de Mesa si es Dine In */}
            {orderType === 1 && (
              <div className="cpos-s-12">
                <span className="cpos-s-13">Mesa #:</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(Number(e.target.value) || 1)}
                  className="cpos-s-14"
                />
              </div>
            )}

            {/* Input de Cliente/Teléfono si es Domicilio */}
            {orderType === 3 && (
              <input
                type="text"
                placeholder="Cliente / Tel / Dirección"
                value={customerInfo}
                onChange={(e) => setCustomerInfo(e.target.value)}
                className="cpos-s-15"
              />
            )}
          </div>
        )}

        {/* Lado Derecho: Estado, Turno de Caja, Agotados y Limpiar */}
        <div className="cpos-s-9">
          <button
            type="button"
            onClick={() => { sfx.playTap(); setShowCashShiftModal(true); }}
            className="cpos-s-16"
            title="Apertura, Arqueo en Vivo y Cierre Z"
          >
            <span>💵 Turno Caja</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.playTap();
              const nextMode = !isStockJiggleMode;
              setIsStockJiggleMode(nextMode);
              if (nextMode) loadStockStatus();
            }}
            className={`cpos-jiggle-toggle-btn ${isStockJiggleMode ? 'active' : ''}`}
            title="Activar/desactivar modo edición estilo iOS para cambiar disponibilidad de platos en vivo"
          >
            {isStockJiggleMode ? (
              <span>✅ Listo (Salir Modo iOS)</span>
            ) : (
              <span>📱 Agotados (Modo iOS)</span>
            )}
          </button>

          {cart.length > 0 && activeView === 'order' && (
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Limpiar comanda actual?')) {
                  sfx.playTap();
                  setCart([]);
                }
              }}
              className="cpos-s-17"
            >
              🗑️ Limpiar Ticket
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. CONTENIDO PRINCIPAL: VISTA RAPID ORDER O POR COBRAR          */}
      {/* ============================================================== */}
      {activeView === 'order' ? (
        <div className="cpos-s-18">
          
          {/* ========================================================== */}
          {/* COLUMNA IZQUIERDA: SELECTOR DE CATEGORÍAS + CATÁLOGO       */}
          {/* ========================================================== */}
          <div className="cpos-s-19">
            
            {/* BARRA SUPERIOR DE CATEGORÍAS RÁPIDAS + BUSCADOR */}
            <div
              className="cpos-s-20"
            >
              {/* Buscador Rápido de Producto */}
              <div className="cpos-s-21">
                <input
                  type="text"
                  placeholder="🔍 Buscar platillo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="cpos-s-22"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="cpos-s-23"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botones de Categorías Horizontales Scrollables */}
              <div
                className="cpos-s-24"
              >
                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setSelectedCategory('ALL'); }}
                  className={`cpos-cat-filter-btn ${selectedCategory === 'ALL' ? 'selected' : ''}`}
                >
                  🔥 TODOS ({allItems.length})
                </button>

                {categories.map((cat) => {
                  const isCatSelected = selectedCategory === cat.name;
                  const count = (cat.items || []).length;
                  return (
                    <button
                      key={cat.id || cat.name}
                      type="button"
                      onClick={() => { sfx.playTap(); setSelectedCategory(cat.name); }}
                      className={`cpos-cat-filter-btn ${isCatSelected ? 'selected' : ''}`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRID DE PRODUCTOS ESTILO RAPID ORDER */}
            <div className="cpos-s-25">
              {/* Banner informativo cuando el modo iOS está activo */}
              {isStockJiggleMode && (
                <div
                  className="cpos-s-26"
                >
                  <div className="cpos-s-9">
                    <span className="cpos-s-27">📱</span>
                    <div>
                      <div className="cpos-s-28">Modo Edición de Stock Activo (Estilo iOS)</div>
                      <div className="cpos-s-29">
                        Toca directamente cualquier tarjeta o su botón para marcarlo como <strong>Disponible 🟢</strong> o <strong>Agotado 🔴</strong>.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { sfx.playTap(); setIsStockJiggleMode(false); }}
                    className="cpos-s-30"
                  >
                    ✅ Listo (Terminar)
                  </button>
                </div>
              )}

              <div
                className="cpos-s-31"
              >
                {filteredItems.map((item, idx) => {
                  const hasModifiers = Boolean(item.modifiers && item.modifiers.length > 0);
                  const inCartQty = cart
                    .filter((c) => c.id === item.id)
                    .reduce((sum, c) => sum + c.quantity, 0);
                  const isItemInactive = item.isActive === false;
                  const isToggling = togglingItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={[
                        'cpos-item-card',
                        isItemInactive ? 'inactive' : 'active',
                        isStockJiggleMode ? (idx % 2 === 0 ? 'jiggle-even' : 'jiggle-odd') : '',
                        inCartQty > 0 && !isItemInactive ? 'in-cart' : '',
                        isToggling ? 'toggling' : ''
                      ].filter(Boolean).join(' ')}
                    >
                      {/* Botón / Badge estilo iOS de Disponibilidad */}
                      {isStockJiggleMode ? (
                        <button
                          type="button"
                          onClick={(e) => handleToggleStockDirect(item, e)}
                          title="Clic para cambiar disponibilidad"
                          className={`cpos-item-jiggle-badge ${isItemInactive ? 'inactive' : 'active'}`}
                        >
                          {isItemInactive ? '🔴 Agotado' : '🟢 Activo'}
                        </button>
                      ) : (
                        isItemInactive && (
                          <div
                            className="cpos-s-32"
                          >
                            AGOTADO (86)
                          </div>
                        )
                      )}

                      {/* Badge de cantidad si está en el carrito */}
                      {!isStockJiggleMode && inCartQty > 0 && (
                        <div
                          className="cpos-s-33"
                        >
                          {inCartQty}
                        </div>
                      )}

                      {/* Info de Producto */}
                      <div>
                        <div className={`cpos-item-cat-label ${isItemInactive && isStockJiggleMode ? 'jiggle-inactive' : ''}`}>
                          {item.categoryName}
                        </div>
                        <div
                          className={`cpos-item-name ${isItemInactive ? (isStockJiggleMode ? 'jiggle-inactive' : 'inactive') : 'active'}`}
                        >
                          {item.name}
                        </div>
                      </div>

                      {/* Footer de Tarjeta con Precio y Badge de Modificadores */}
                      <div className="cpos-s-34">
                        <span className={`cpos-item-price ${isItemInactive ? 'inactive' : 'active'}`}>
                          {formatCOP(item.price)}
                        </span>

                        <div className="cpos-s-35">
                          {hasModifiers ? (
                            <span
                              title="Tiene modificadores configurables"
                              className="cpos-s-36"
                            >
                              ✨ Mods
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sfx.playTap();
                                setModifyingItem(item);
                              }}
                              title="Personalizar notas"
                              className="cpos-s-37"
                            >
                              ⚙️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredItems.length === 0 && (
                  <div className="cpos-s-38">
                    <div className="cpos-s-39">🔍</div>
                    <div className="cpos-s-40">No se encontraron platillos</div>
                    <div className="cpos-s-41">Prueba con otro término de búsqueda o selecciona otra categoría.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* COLUMNA DERECHA: TICKET DE COMANDA / GUEST CHECK ALDELO    */}
          {/* ========================================================== */}
          <div
            className="cpos-s-42"
          >
            {/* Header del Ticket con identificación de MESA vs PARA LLEVAR */}
            <div
              className={`cpos-ticket-header type-${orderType}`}
            >
              <div>
                <div className="cpos-s-43">
                  <span>{orderType === 1 ? '🍽️' : orderType === 2 ? '🥡' : '🛵'}</span>
                  <span>{orderType === 1 ? `Comanda Mesa #${selectedTable}` : orderType === 2 ? 'Comanda PARA LLEVAR' : 'Comanda DOMICILIO'}</span>
                </div>
                <div className="cpos-s-44">
                  {orderType === 1 ? 'Servicio en salón / mesa' : orderType === 2 ? 'Entrega en mostrador para llevar' : customerInfo || 'Entrega a domicilio'}
                </div>
              </div>

              <span
                className="cpos-s-45"
              >
                {cart.reduce((s, i) => s + i.quantity, 0)} ítems
              </span>
            </div>

            {/* Lista detallada de productos en comanda */}
            <div className="cpos-s-46">
              {cart.map((item) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <div
                    key={item.cartItemId}
                    className="cpos-s-47"
                  >
                    <div className="cpos-s-48">
                      <div className="cpos-s-49">
                        <span className="cpos-s-50">
                          {item.name}
                        </span>
                        <span className="cpos-s-51">
                          {formatCOP(item.price)}
                        </span>
                      </div>

                      {/* Controles de Cantidad */}
                      <div className="cpos-s-35">
                        <button
                          type="button"
                          onClick={() => updateQty(item.cartItemId, -1)}
                          className="cpos-s-52"
                        >
                          -
                        </button>
                        <span className="cpos-s-53">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.cartItemId, 1)}
                          className="cpos-s-54"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.cartItemId)}
                          className="cpos-s-55"
                          title="Eliminar ítem"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Modificadores indentados */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="cpos-s-56">
                        {item.modifiers.map((m) => (
                          <div key={m.id || m.name} className="cpos-s-57">
                            + {m.name} {m.price > 0 ? `(${formatCOP(m.price)})` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notas de preparación */}
                    {item.notes && (
                      <div className="cpos-s-58">
                        📝 {item.notes}
                      </div>
                    )}

                    <div className="cpos-s-59">
                      Subtotal: {formatCOP(itemTotal)}
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div className="cpos-s-60">
                  <div className="cpos-s-61">🍽️</div>
                  Ticket vacío.<br />Selecciona platillos del menú para comenzar la orden.
                </div>
              )}
            </div>

            {/* Input para notas generales de la comanda */}
            {cart.length > 0 && (
              <div className="cpos-s-62">
                <input
                  type="text"
                  placeholder="Observación general para cocina..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="cpos-s-63"
                />
              </div>
            )}

            {/* FOOTER DEL TICKET: TOTALES Y ACCIONES DE ALDELO RAPID ORDER */}
            <div className="cpos-s-64">
              <div className="cpos-s-65">
                <span className="cpos-s-66">TOTAL:</span>
                <span className="cpos-s-67">{formatCOP(total)}</span>
              </div>

              {/* MODO DESPLEGADO DE PAGO DIRECTO */}
              {showPaymentDrawer ? (
                <div className="cpos-s-68">
                  <div className="cpos-s-69">
                    <span className="cpos-s-70">Método de Pago:</span>
                    <button
                      type="button"
                      onClick={() => setShowPaymentDrawer(false)}
                      className="cpos-s-71"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  {/* Selector de Método de Pago */}
                  <div className="cpos-s-72">
                    {[
                      { id: 'CASH', label: '💵 Efectivo' },
                      { id: 'CARD', label: '💳 Datáfono' },
                      { id: 'WOMPI_QR', label: '📱 QR' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { sfx.playTap(); setPaymentMethod(m.id); }}
                        className={`cpos-drawer-pay-btn ${paymentMethod === m.id ? 'active' : ''}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Cálculo de cambio para Efectivo con denominaciones rápidas */}
                  {paymentMethod === 'CASH' && (
                    <div className="cpos-s-73">
                      <input
                        type="number"
                        placeholder="Monto entregado en COP"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="cpos-s-74"
                      />

                      {/* Denominaciones rápidas en Colombia */}
                      <div className="cpos-s-75">
                        {[
                          { label: 'Exacto', val: totalCOPVal },
                          { label: '$20k', val: 20000 },
                          { label: '$50k', val: 50000 },
                          { label: '$100k', val: 100000 }
                        ].map((den) => (
                          <button
                            key={den.label}
                            type="button"
                            onClick={() => { sfx.playTap(); setCashTendered(String(den.val)); }}
                            className="cpos-s-76"
                          >
                            {den.label}
                          </button>
                        ))}
                      </div>

                      {cashNum > 0 && (
                        <div
                          className={`cpos-drawer-change-text ${changeCOP >= 0 && cashNum >= totalCOPVal ? 'ok' : 'under'}`}
                        >
                          {cashNum >= totalCOPVal
                            ? `Cambio: $${changeCOP.toLocaleString('es-CO')}`
                            : 'Monto menor al total'}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isSubmitting || (paymentMethod === 'CASH' && cashNum > 0 && cashNum < totalCOPVal)}
                    onClick={handleSettleImmediateOrder}
                    className="cpos-s-77"
                  >
                    {isSubmitting ? 'Registrando...' : '✅ Confirmar Cobro y Cerrar'}
                  </button>
                </div>
              ) : (
                /* BOTONES DE ACCIÓN PRINCIPALES ESTILO ALDELO */
                <div className="cpos-s-78">
                  {/* Botón 1: Enviar a Cocina (Pendiente / Orden Abierta) */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={handleSendToKitchenPending}
                    className={`cpos-action-btn send-kitchen ${cart.length > 0 ? 'enabled' : 'disabled'}`}
                  >
                    <span>👨‍🍳 Enviar a Cocina</span>
                    <span className="cpos-s-79">Cuenta Pendiente</span>
                  </button>

                  {/* Botón 2: Cobrar Inmediato (Pagada / Cerrada) */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={() => {
                      sfx.playTap();
                      setShowPaymentDrawer(true);
                      setCashTendered(String(totalCOPVal));
                    }}
                    className={`cpos-action-btn pay-now ${cart.length > 0 ? 'enabled' : 'disabled'}`}
                  >
                    <span>💵 Cobrar Inmediato</span>
                    <span className="cpos-s-79">Cerrar Venta</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* 3. VISTA DE ÓRDENES QUE NECESITAN COMPLETAR PAGO               */
        /* (Con clara distinción visual: PARA LLEVAR vs MESA)             */
        /* ============================================================== */
        <div className="cpos-s-80">
          <div className="cpos-s-81">
            
            {/* Header y Filtros Rápidos (Todos / Para Llevar / En Mesa) */}
            <div className="cpos-s-82">
              <div>
                <h2 className="cpos-s-83">
                  💳 Órdenes Pendientes de Pago ({pendingPaymentOrders.length})
                </h2>
                <div className="cpos-s-84">
                  Verifica si el cliente ordenó <strong>Para Llevar</strong> o para consumir en <strong>Mesa</strong> antes de cobrar.
                </div>
              </div>

              {/* Pestañas de Filtro: Todos / Para Llevar / En Mesa */}
              <div className="cpos-s-85">
                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setServiceFilter('ALL'); }}
                  className={`cpos-pending-filter-tab all ${serviceFilter === 'ALL' ? 'active' : ''}`}
                >
                  📋 Todas ({pendingPaymentOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setServiceFilter('TAKE_OUT'); }}
                  className={`cpos-pending-filter-tab takeout ${serviceFilter === 'TAKE_OUT' ? 'active' : ''}`}
                >
                  🥡 Para Llevar ({takeOutCount})
                </button>

                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setServiceFilter('DINE_IN'); }}
                  className={`cpos-pending-filter-tab dinein ${serviceFilter === 'DINE_IN' ? 'active' : ''}`}
                >
                  🍽️ En Mesa ({dineInCount})
                </button>
              </div>
            </div>

            {/* Lista de Órdenes */}
            {displayedPendingOrders.length === 0 ? (
              <div className="cpos-s-86">
                <div className="cpos-s-87">✅</div>
                <div className="cpos-s-88">
                  {serviceFilter === 'ALL'
                    ? '¡No hay órdenes pendientes de pago!'
                    : serviceFilter === 'TAKE_OUT'
                    ? 'No hay órdenes Para Llevar pendientes'
                    : 'No hay órdenes en Mesa pendientes'}
                </div>
                <div className="cpos-s-89">
                  Todos los pedidos han sido pagados y están en preparación.
                </div>
              </div>
            ) : (
              <div className="cpos-s-90">
                {displayedPendingOrders.map((order) => {
                  const elapsed = getElapsedMinutes(order.createdAt);
                  const isTakeOut = Number(order.orderType) === 2 || !order.tableId;

                  return (
                    <div
                      key={order.id}
                      className={`cpos-pending-order-card ${isTakeOut ? 'takeout' : 'dinein'}`}
                    >
                      {/* Cabecera de la orden */}
                      <div>
                        {/* 1. DISTINCIÓN CLARA Y VISIBLE: PARA LLEVAR VS MESA */}
                        <div className="cpos-s-91">
                          {isTakeOut ? (
                            <span
                              className="cpos-s-92"
                            >
                              <span className="cpos-s-93">🥡</span>
                              <span>PARA LLEVAR</span>
                            </span>
                          ) : (
                            <span
                              className="cpos-s-94"
                            >
                              <span className="cpos-s-93">🍽️</span>
                              <span>MESA #{order.tableId || 'S/M'}</span>
                            </span>
                          )}

                          <span className="cpos-s-95">
                            ⏱️ {elapsed} min
                          </span>
                        </div>

                        {/* Turno gigante para rápida identificación del cliente */}
                        <div className="cpos-s-96">
                          <div className="cpos-s-97">
                            <span className="cpos-s-98">
                              Turno #{order.orderNumber || order.id}
                            </span>
                            <span
                              className={`cpos-pending-service-tag ${isTakeOut ? 'takeout' : 'dinein'}`}
                            >
                              {isTakeOut ? '• Para Llevar' : `• Mesa ${order.tableId}`}
                            </span>
                          </div>

                          <span
                            className="cpos-s-99"
                          >
                            ⏳ POR COBRAR
                          </span>
                        </div>

                        {/* Lista de platillos */}
                        <div className="cpos-s-100">
                          {(order.items || []).map((it, idx) => (
                            <div key={idx} className="cpos-s-101">
                              <span>
                                <strong>{it.quantity || 1}x</strong> {it.name}
                              </span>
                              <span className="cpos-s-102">{formatCOP(it.price * (it.quantity || 1))}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total a cobrar */}
                        <div className="cpos-s-103">
                          <span className="cpos-s-104">Total a Cobrar:</span>
                          <span className="cpos-s-105">{formatCOP(order.total)}</span>
                        </div>
                      </div>

                      {/* Botones de acción rápida para completar pago */}
                      <div className="cpos-s-106">
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playTap();
                            setSettlingOrder(order);
                            setSettleCashTendered(String(Math.round(order.total * 1000)));
                          }}
                          className="cpos-s-107"
                        >
                          <span>💵 Completar Pago</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadPendingOrderToTicket(order)}
                          className="cpos-s-108"
                        >
                          👁️ Cargar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleVoidOrder(order.id)}
                          className="cpos-s-109"
                          title="Anular orden"
                        >
                          ✕
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
      {/* 4. MODAL DE MODIFICADORES (REUTILIZANDO MODIFIERMODAL KIOSK)     */}
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
