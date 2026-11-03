import React, { useState, useEffect, useMemo } from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { useKdsStore } from '../../store/useKdsStore';
import { fetchEmployees, createOrder, updateOrderStatus, fetchTables } from '../../api';
import { formatCOP, getElapsedMinutes, formatRegularTime } from '../../utils/format';
import { sfx } from '../../utils/audio';
import { ModifierModal } from '../kiosk/ModifierModal';

export function CashierView() {
  const categories = useMenuStore((state) => state.categories);
  const activeOrders = useKdsStore((state) => state.activeOrders);

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
  }, []);

  // Platillos con su categoría asociada
  const allItems = useMemo(() => {
    return categories.flatMap((c) =>
      (c.items || []).map((it) => ({
        ...it,
        categoryName: c.name,
        categoryId: c.id
      }))
    );
  }, [categories]);

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

  // Agregar producto al hacer clic en tarjeta
  const handleItemClick = (item) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#f1f5f9' }}>
      
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DE RAPID ORDER (ESTILO ALDELO POS)           */}
      {/* ============================================================== */}
      <div
        style={{
          background: '#1e293b',
          color: '#ffffff',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 30
        }}
      >
        {/* Lado Izquierdo: Selector de Cajero y Pestañas de Vista */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Selector de Cajero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 800 }}>👤 Cajero:</span>
            <select
              value={currentCashier}
              onChange={(e) => setCurrentCashier(Number(e.target.value))}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '5px 10px',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
              {employees.length === 0 && <option value={1}>Cajero Principal</option>}
            </select>
          </div>

          <div style={{ width: '1px', height: '24px', background: '#334155' }} />

          {/* Selector de Vista: Nueva Comanda vs Órdenes por Cobrar */}
          <div style={{ display: 'flex', background: '#0f172a', padding: '3px', borderRadius: '10px', gap: '2px' }}>
            <button
              type="button"
              onClick={() => { sfx.playTap(); setActiveView('order'); }}
              style={{
                background: activeView === 'order' ? '#3b82f6' : 'transparent',
                color: '#ffffff',
                border: 'none',
                borderRadius: '7px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>⚡ Rapid Order</span>
            </button>
            <button
              type="button"
              onClick={() => { sfx.playTap(); setActiveView('pending_payments'); }}
              style={{
                background: activeView === 'pending_payments' ? '#f59e0b' : 'transparent',
                color: activeView === 'pending_payments' ? '#0f172a' : '#94a3b8',
                border: 'none',
                borderRadius: '7px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>💳 Por Cobrar ({pendingPaymentOrders.length})</span>
              {pendingPaymentOrders.length > 0 && (
                <span
                  style={{
                    background: activeView === 'pending_payments' ? '#dc2626' : '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontWeight: 900
                  }}
                >
                  {pendingPaymentOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Lado Central: Selector de Tipo de Servicio (Order Type) */}
        {activeView === 'order' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 800 }}>Servicio:</span>
            <div style={{ display: 'flex', background: '#0f172a', padding: '3px', borderRadius: '10px', gap: '4px' }}>
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
                    style={{
                      background: isSelected ? (t.id === 2 ? '#f59e0b' : '#10b981') : 'transparent',
                      color: isSelected ? (t.id === 2 ? '#0f172a' : '#ffffff') : '#cbd5e1',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '5px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Selector de Mesa si es Dine In */}
            {orderType === 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', padding: '3px 8px', borderRadius: '8px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 800 }}>Mesa #:</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(Number(e.target.value) || 1)}
                  style={{
                    width: '46px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#1e293b',
                    color: '#38bdf8',
                    textAlign: 'center',
                    fontWeight: 900,
                    fontSize: '0.95rem'
                  }}
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
                style={{
                  height: '30px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  width: '210px'
                }}
              />
            )}
          </div>
        )}

        {/* Lado Derecho: Estado y Limpiar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {cart.length > 0 && activeView === 'order' && (
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Limpiar comanda actual?')) {
                  sfx.playTap();
                  setCart([]);
                }
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
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
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* ========================================================== */}
          {/* COLUMNA IZQUIERDA: SELECTOR DE CATEGORÍAS + CATÁLOGO       */}
          {/* ========================================================== */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
            
            {/* BARRA SUPERIOR DE CATEGORÍAS RÁPIDAS + BUSCADOR */}
            <div
              style={{
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {/* Buscador Rápido de Producto */}
              <div style={{ width: '220px', position: 'relative', flexShrink: 0 }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar platillo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    padding: '0 10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxSizing: 'border-box'
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '8px', top: '8px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, color: '#94a3b8' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botones de Categorías Horizontales Scrollables */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '2px',
                  alignItems: 'center',
                  flex: 1
                }}
              >
                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setSelectedCategory('ALL'); }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: selectedCategory === 'ALL' ? '2px solid #da291c' : '1px solid #cbd5e1',
                    background: selectedCategory === 'ALL' ? '#da291c' : '#ffffff',
                    color: selectedCategory === 'ALL' ? '#ffffff' : '#334155',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: selectedCategory === 'ALL' ? '0 2px 6px rgba(218, 41, 28, 0.25)' : 'none'
                  }}
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
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: isCatSelected ? '2px solid #da291c' : '1px solid #cbd5e1',
                        background: isCatSelected ? '#da291c' : '#ffffff',
                        color: isCatSelected ? '#ffffff' : '#334155',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: isCatSelected ? '0 2px 6px rgba(218, 41, 28, 0.25)' : 'none'
                      }}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRID DE PRODUCTOS ESTILO RAPID ORDER */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', background: '#f1f5f9' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: '10px'
                }}
              >
                {filteredItems.map((item) => {
                  const hasModifiers = Boolean(item.modifiers && item.modifiers.length > 0);
                  const inCartQty = cart
                    .filter((c) => c.id === item.id)
                    .reduce((sum, c) => sum + c.quantity, 0);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      style={{
                        background: '#ffffff',
                        border: inCartQty > 0 ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '105px',
                        position: 'relative',
                        boxShadow: inCartQty > 0 ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'all 0.12s ease',
                        userSelect: 'none'
                      }}
                    >
                      {/* Badge de cantidad si está en el carrito */}
                      {inCartQty > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        >
                          {inCartQty}
                        </div>
                      )}

                      {/* Info de Producto */}
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                          {item.categoryName}
                        </div>
                        <div
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            marginTop: '2px',
                            lineHeight: 1.25
                          }}
                        >
                          {item.name}
                        </div>
                      </div>

                      {/* Footer de Tarjeta con Precio y Badge de Modificadores */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#059669' }}>
                          {formatCOP(item.price)}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {hasModifiers ? (
                            <span
                              title="Tiene modificadores configurables"
                              style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontWeight: 800
                              }}
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
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '2px 5px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                fontWeight: 700
                              }}
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
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>No se encontraron platillos</div>
                    <div style={{ fontSize: '0.85rem' }}>Prueba con otro término de búsqueda o selecciona otra categoría.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* COLUMNA DERECHA: TICKET DE COMANDA / GUEST CHECK ALDELO    */}
          {/* ========================================================== */}
          <div
            style={{
              width: '420px',
              height: '100%',
              flexShrink: 0,
              borderLeft: '2px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-2px 0 10px rgba(0,0,0,0.05)'
            }}
          >
            {/* Header del Ticket con identificación de MESA vs PARA LLEVAR */}
            <div
              style={{
                padding: '12px 16px',
                background: orderType === 1 ? '#eff6ff' : orderType === 2 ? '#ecfdf5' : '#f5f3ff',
                borderBottom: '2px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{orderType === 1 ? '🍽️' : orderType === 2 ? '🥡' : '🛵'}</span>
                  <span>{orderType === 1 ? `Comanda Mesa #${selectedTable}` : orderType === 2 ? 'Comanda PARA LLEVAR' : 'Comanda DOMICILIO'}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                  {orderType === 1 ? 'Servicio en salón / mesa' : orderType === 2 ? 'Entrega en mostrador para llevar' : customerInfo || 'Entrega a domicilio'}
                </div>
              </div>

              <span
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1'
                }}
              >
                {cart.reduce((s, i) => s + i.quantity, 0)} ítems
              </span>
            </div>

            {/* Lista detallada de productos en comanda */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cart.map((item) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <div
                    key={item.cartItemId}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                          {item.name}
                        </span>
                        <span style={{ marginLeft: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
                          {formatCOP(item.price)}
                        </span>
                      </div>

                      {/* Controles de Cantidad */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => updateQty(item.cartItemId, -1)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 900,
                            fontSize: '0.9rem'
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 900, fontSize: '0.88rem' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.cartItemId, 1)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: '1px solid #10b981',
                            background: '#ecfdf5',
                            color: '#059669',
                            cursor: 'pointer',
                            fontWeight: 900,
                            fontSize: '0.9rem'
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.cartItemId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            marginLeft: '4px'
                          }}
                          title="Eliminar ítem"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Modificadores indentados */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div style={{ paddingLeft: '8px', borderLeft: '2px solid #cbd5e1', marginTop: '2px' }}>
                        {item.modifiers.map((m) => (
                          <div key={m.id || m.name} style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                            + {m.name} {m.price > 0 ? `(${formatCOP(m.price)})` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notas de preparación */}
                    {item.notes && (
                      <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700, fontStyle: 'italic', paddingLeft: '8px' }}>
                        📝 {item.notes}
                      </div>
                    )}

                    <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 900, color: '#1e293b', borderTop: '1px dashed #e2e8f0', paddingTop: '3px' }}>
                      Subtotal: {formatCOP(itemTotal)}
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '50px 20px', fontSize: '0.9rem', fontWeight: 600 }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍽️</div>
                  Ticket vacío.<br />Selecciona platillos del menú para comenzar la orden.
                </div>
              )}
            </div>

            {/* Input para notas generales de la comanda */}
            {cart.length > 0 && (
              <div style={{ padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <input
                  type="text"
                  placeholder="Observación general para cocina..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    padding: '0 8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* FOOTER DEL TICKET: TOTALES Y ACCIONES DE ALDELO RAPID ORDER */}
            <div style={{ padding: '14px 16px', background: '#ffffff', borderTop: '2px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748b' }}>TOTAL:</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>{formatCOP(total)}</span>
              </div>

              {/* MODO DESPLEGADO DE PAGO DIRECTO */}
              {showPaymentDrawer ? (
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px', border: '1.5px solid #cbd5e1', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>Método de Pago:</span>
                    <button
                      type="button"
                      onClick={() => setShowPaymentDrawer(false)}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  {/* Selector de Método de Pago */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                    {[
                      { id: 'CASH', label: '💵 Efectivo' },
                      { id: 'CARD', label: '💳 Datáfono' },
                      { id: 'WOMPI_QR', label: '📱 QR' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { sfx.playTap(); setPaymentMethod(m.id); }}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '8px',
                          border: paymentMethod === m.id ? '2px solid #10b981' : '1px solid #cbd5e1',
                          background: paymentMethod === m.id ? '#ecfdf5' : '#ffffff',
                          color: paymentMethod === m.id ? '#059669' : '#475569',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Cálculo de cambio para Efectivo con denominaciones rápidas */}
                  {paymentMethod === 'CASH' && (
                    <div style={{ marginBottom: '10px' }}>
                      <input
                        type="number"
                        placeholder="Monto entregado en COP"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          borderRadius: '6px',
                          border: '1.5px solid #cbd5e1',
                          padding: '0 8px',
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* Denominaciones rápidas en Colombia */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
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
                            style={{
                              flex: 1,
                              padding: '4px 0',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {den.label}
                          </button>
                        ))}
                      </div>

                      {cashNum > 0 && (
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 900,
                            color: changeCOP >= 0 && cashNum >= totalCOPVal ? '#059669' : '#ef4444',
                            marginTop: '6px',
                            textAlign: 'right'
                          }}
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
                    style={{
                      width: '100%',
                      height: '44px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    {isSubmitting ? 'Registrando...' : '✅ Confirmar Cobro y Cerrar'}
                  </button>
                </div>
              ) : (
                /* BOTONES DE ACCIÓN PRINCIPALES ESTILO ALDELO */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {/* Botón 1: Enviar a Cocina (Pendiente / Orden Abierta) */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={handleSendToKitchenPending}
                    style={{
                      height: '48px',
                      borderRadius: '10px',
                      background: cart.length > 0 ? '#0284c7' : '#cbd5e1',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      border: 'none',
                      cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: cart.length > 0 ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none'
                    }}
                  >
                    <span>👨‍🍳 Enviar a Cocina</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>Cuenta Pendiente</span>
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
                    style={{
                      height: '48px',
                      borderRadius: '10px',
                      background: cart.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      border: 'none',
                      cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: cart.length > 0 ? '0 2px 6px rgba(16, 185, 129, 0.25)' : 'none'
                    }}
                  >
                    <span>💵 Cobrar Inmediato</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>Cerrar Venta</span>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f8fafc' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            
            {/* Header y Filtros Rápidos (Todos / Para Llevar / En Mesa) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                  💳 Órdenes Pendientes de Pago ({pendingPaymentOrders.length})
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                  Verifica si el cliente ordenó <strong>Para Llevar</strong> o para consumir en <strong>Mesa</strong> antes de cobrar.
                </div>
              </div>

              {/* Pestañas de Filtro: Todos / Para Llevar / En Mesa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e2e8f0', padding: '3px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setServiceFilter('ALL'); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: serviceFilter === 'ALL' ? '#ffffff' : 'transparent',
                    color: serviceFilter === 'ALL' ? '#0f172a' : '#64748b',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: serviceFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  📋 Todas ({pendingPaymentOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setServiceFilter('TAKE_OUT'); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: serviceFilter === 'TAKE_OUT' ? '#10b981' : 'transparent',
                    color: serviceFilter === 'TAKE_OUT' ? '#ffffff' : '#047857',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: serviceFilter === 'TAKE_OUT' ? '0 1px 3px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                >
                  🥡 Para Llevar ({takeOutCount})
                </button>

                <button
                  type="button"
                  onClick={() => { sfx.playTap(); setServiceFilter('DINE_IN'); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: serviceFilter === 'DINE_IN' ? '#3b82f6' : 'transparent',
                    color: serviceFilter === 'DINE_IN' ? '#ffffff' : '#1d4ed8',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: serviceFilter === 'DINE_IN' ? '0 1px 3px rgba(59, 130, 246, 0.3)' : 'none'
                  }}
                >
                  🍽️ En Mesa ({dineInCount})
                </button>
              </div>
            </div>

            {/* Lista de Órdenes */}
            {displayedPendingOrders.length === 0 ? (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                  {serviceFilter === 'ALL'
                    ? '¡No hay órdenes pendientes de pago!'
                    : serviceFilter === 'TAKE_OUT'
                    ? 'No hay órdenes Para Llevar pendientes'
                    : 'No hay órdenes en Mesa pendientes'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                  Todos los pedidos han sido pagados y están en preparación.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {displayedPendingOrders.map((order) => {
                  const elapsed = getElapsedMinutes(order.createdAt);
                  const isTakeOut = Number(order.orderType) === 2 || !order.tableId;

                  return (
                    <div
                      key={order.id}
                      style={{
                        background: '#ffffff',
                        border: isTakeOut ? '2.5px solid #10b981' : '2.5px solid #3b82f6',
                        borderRadius: '16px',
                        padding: '16px',
                        boxShadow: isTakeOut
                          ? '0 4px 16px rgba(16, 185, 129, 0.12)'
                          : '0 4px 16px rgba(59, 130, 246, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      {/* Cabecera de la orden */}
                      <div>
                        {/* 1. DISTINCIÓN CLARA Y VISIBLE: PARA LLEVAR VS MESA */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          {isTakeOut ? (
                            <span
                              style={{
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '2px solid #34d399',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontWeight: 900,
                                fontSize: '0.92rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 3px rgba(6, 95, 70, 0.12)'
                              }}
                            >
                              <span style={{ fontSize: '1.1rem' }}>🥡</span>
                              <span>PARA LLEVAR</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#eff6ff',
                                color: '#1e40af',
                                border: '2px solid #60a5fa',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontWeight: 900,
                                fontSize: '0.92rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 3px rgba(30, 64, 175, 0.12)'
                              }}
                            >
                              <span style={{ fontSize: '1.1rem' }}>🍽️</span>
                              <span>MESA #{order.tableId || 'S/M'}</span>
                            </span>
                          )}

                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>
                            ⏱️ {elapsed} min
                          </span>
                        </div>

                        {/* Turno gigante para rápida identificación del cliente */}
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a' }}>
                              Turno #{order.orderNumber || order.id}
                            </span>
                            <span
                              style={{
                                fontSize: '0.92rem',
                                fontWeight: 900,
                                color: isTakeOut ? '#047857' : '#1d4ed8'
                              }}
                            >
                              {isTakeOut ? '• Para Llevar' : `• Mesa ${order.tableId}`}
                            </span>
                          </div>

                          <span
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            ⏳ POR COBRAR
                          </span>
                        </div>

                        {/* Lista de platillos */}
                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', margin: '8px 0', maxHeight: '130px', overflowY: 'auto' }}>
                          {(order.items || []).map((it, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem', color: '#1e293b', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>
                                <strong>{it.quantity || 1}x</strong> {it.name}
                              </span>
                              <span style={{ fontWeight: 700, color: '#64748b' }}>{formatCOP(it.price * (it.quantity || 1))}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total a cobrar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 6px 0' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#64748b' }}>Total a Cobrar:</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>{formatCOP(order.total)}</span>
                        </div>
                      </div>

                      {/* Botones de acción rápida para completar pago */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 38px', gap: '6px', marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playTap();
                            setSettlingOrder(order);
                            setSettleCashTendered(String(Math.round(order.total * 1000)));
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '11px 12px',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <span>💵 Completar Pago</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadPendingOrderToTicket(order)}
                          style={{
                            background: '#f1f5f9',
                            color: '#0f172a',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            padding: '8px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          👁️ Cargar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleVoidOrder(order.id)}
                          style={{
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 800
                          }}
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
      {settlingOrder && (() => {
        const isModalTakeOut = Number(settlingOrder.orderType) === 2 || !settlingOrder.tableId;

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '24px',
                width: '450px',
                maxWidth: '92vw',
                boxShadow: '0 12px 30px rgba(0,0,0,0.22)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                    💵 Completar Pago de Orden
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 800, marginTop: '2px' }}>
                    Turno #{settlingOrder.orderNumber || settlingOrder.id}
                  </div>
                </div>
                <button
                  onClick={() => setSettlingOrder(null)}
                  style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              {/* BANNER ULTRA VISIBLE: PARA LLEVAR VS EN MESA */}
              <div
                style={{
                  background: isModalTakeOut ? '#ecfdf5' : '#eff6ff',
                  border: `2px solid ${isModalTakeOut ? '#34d399' : '#60a5fa'}`,
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ fontWeight: 900, fontSize: '1.05rem', color: isModalTakeOut ? '#065f46' : '#1e40af' }}>
                  {isModalTakeOut ? '🥡 PEDIDO PARA LLEVAR' : `🍽️ PEDIDO EN MESA #${settlingOrder.tableId || 'S/M'}`}
                </span>
                <span
                  style={{
                    background: isModalTakeOut ? '#065f46' : '#1e40af',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 900
                  }}
                >
                  {isModalTakeOut ? 'LLEVAR' : 'SALÓN'}
                </span>
              </div>

              {/* Cuadro destacado de monto */}
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Total a Cobrar</div>
                <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                  {formatCOP(settlingOrder.total)}
                </div>
              </div>

              {/* Selector de Método de Pago recibido en caja */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Método de pago recibido:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'CASH', label: '💵 Efectivo' },
                    { id: 'CARD', label: '💳 Datáfono' },
                    { id: 'WOMPI_QR', label: '📱 QR' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettlePayMethod(m.id)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '8px',
                        border: settlePayMethod === m.id ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: settlePayMethod === m.id ? '#ecfdf5' : '#ffffff',
                        color: settlePayMethod === m.id ? '#059669' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Si es efectivo, cálculo de cambio con denominaciones */}
              {settlePayMethod === 'CASH' && (
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="number"
                    placeholder="Monto entregado en COP"
                    value={settleCashTendered}
                    onChange={(e) => setSettleCashTendered(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      padding: '0 10px',
                      fontSize: '1rem',
                      fontWeight: 800,
                      boxSizing: 'border-box'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {[
                      { label: 'Exacto', val: Math.round(settlingOrder.total * 1000) },
                      { label: '$20k', val: 20000 },
                      { label: '$50k', val: 50000 },
                      { label: '$100k', val: 100000 }
                    ].map((den) => (
                      <button
                        key={den.label}
                        type="button"
                        onClick={() => { sfx.playTap(); setSettleCashTendered(String(den.val)); }}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {den.label}
                      </button>
                    ))}
                  </div>

                  {parseFloat(settleCashTendered) > 0 && (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 900,
                        color: parseFloat(settleCashTendered) >= Math.round(settlingOrder.total * 1000) ? '#059669' : '#ef4444',
                        textAlign: 'right'
                      }}
                    >
                      {parseFloat(settleCashTendered) >= Math.round(settlingOrder.total * 1000)
                        ? `Cambio: $${Math.max(0, parseFloat(settleCashTendered) - Math.round(settlingOrder.total * 1000)).toLocaleString('es-CO')}`
                        : 'Monto menor al total'}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSettlePendingOrder}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                {isSubmitting ? 'Procesando...' : '✅ Confirmar Pago y Enviar a Cocina'}
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
