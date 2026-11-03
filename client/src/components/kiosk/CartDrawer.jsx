import React, { useRef, useEffect } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { formatCOP } from '../../utils/format';

export function CartDrawer({ isOpen, onClose, onCheckout }) {
  const cart = useCartStore((state) => state.cart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);
  const orderType = useCartStore((state) => state.orderType) || 'DINE_IN';
  const setOrderType = useCartStore((state) => state.setOrderType);

  const cartListRef = useRef(null);
  const prevLengthRef = useRef(cart.length);

  // Auto-scroll al final cuando se añade un nuevo producto
  useEffect(() => {
    if (cart.length > prevLengthRef.current && cartListRef.current) {
      cartListRef.current.scrollTop = cartListRef.current.scrollHeight;
    }
    prevLengthRef.current = cart.length;
  }, [cart]);

  if (!isOpen) return null;

  const total = getTotalAmount();
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div
      className="cart-drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="cart-drawer-slide"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header Mi Pedido */}
        <div
          className="cart-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                Mi Pedido
              </span>
              <span
                style={{
                  background: '#ffbc0d',
                  color: '#000000',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 900
                }}
              >
                {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            {/* Botón Cerrar Drawer */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                background: '#f1f5f9',
                color: '#475569',
                fontWeight: 900,
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Volver al menú"
            >
              ✕
            </button>
          </div>

          {/* Toggle Comer Aquí / Para Llevar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px'
            }}
          >
            <button
              type="button"
              onClick={() => setOrderType && setOrderType('DINE_IN')}
              style={{
                padding: '8px 10px',
                borderRadius: '9px',
                border: orderType === 'DINE_IN' ? '1.5px solid #fecaca' : 'none',
                background: orderType === 'DINE_IN' ? '#ffffff' : 'transparent',
                color: orderType === 'DINE_IN' ? '#da291c' : '#64748b',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: orderType === 'DINE_IN' ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🍽️ Comer Aquí
            </button>
            <button
              type="button"
              onClick={() => setOrderType && setOrderType('TAKE_OUT')}
              style={{
                padding: '8px 10px',
                borderRadius: '9px',
                border: orderType === 'TAKE_OUT' ? '1.5px solid #fecaca' : 'none',
                background: orderType === 'TAKE_OUT' ? '#ffffff' : 'transparent',
                color: orderType === 'TAKE_OUT' ? '#da291c' : '#64748b',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: orderType === 'TAKE_OUT' ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🥡 Para Llevar
            </button>
          </div>
        </div>

        {/* Items List */}
        <div
          ref={cartListRef}
          className="cart-items-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {cart.map((item) => {
            const itemKey = item.cartItemId || item.id;
            return (
              <div
                key={itemKey}
                className="cart-item-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '14px',
                  border: '1px solid #f1f5f9'
                }}
              >
                <div style={{ flex: 1, paddingRight: '10px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a' }}>
                    {item.name}
                  </div>

                  {/* Modificadores seleccionados */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: '#b45309',
                        marginTop: '2px',
                        lineHeight: 1.2
                      }}
                    >
                      + {item.modifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}

                  {/* Notas especiales */}
                  {item.notes && (
                    <div
                      style={{
                        fontSize: '0.73rem',
                        color: '#64748b',
                        fontStyle: 'italic',
                        marginTop: '2px'
                      }}
                    >
                      📝 {item.notes}
                    </div>
                  )}

                  <div style={{ fontWeight: 900, fontSize: '0.92rem', color: '#0f172a', marginTop: '4px' }}>
                    {formatCOP(item.price * item.quantity)}
                  </div>
                </div>

                {/* Controles de cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, -1)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontWeight: 900,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 900, minWidth: '22px', textAlign: 'center', fontSize: '1rem' }}>
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, 1)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1.5px solid #f59e0b',
                      background: '#fffdf0',
                      color: '#b45309',
                      fontWeight: 900,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#94a3b8',
                padding: '60px 16px'
              }}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🥙</div>
              <div style={{ fontWeight: 800, color: '#334155', fontSize: '1.05rem', marginBottom: '4px' }}>
                Tu orden está vacía
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                Selecciona productos del menú para comenzar.
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Volver al Menú
              </button>
            </div>
          )}
        </div>

        {/* Footer Fijo Total & Botones */}
        <div
          className="cart-footer"
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#64748b' }}>
              Total a Pagar:
            </span>
            <span style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0f172a' }}>
              {formatCOP(total)}
            </span>
          </div>

          {/* Botón Finalizar y Pagar */}
          <button
            type="button"
            className="cart-checkout-btn"
            disabled={cart.length === 0}
            onClick={() => {
              if (onClose) onClose();
              if (onCheckout) onCheckout();
            }}
            style={{
              width: '100%',
              height: '50px',
              borderRadius: '14px',
              background: cart.length > 0 ? '#ffbc0d' : '#cbd5e1',
              color: cart.length > 0 ? '#000000' : '#64748b',
              fontWeight: 900,
              fontSize: '1.05rem',
              border: 'none',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow: cart.length > 0 ? '0 4px 16px rgba(255, 188, 13, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Finalizar y Pagar</span>
          </button>

          {/* Botón Cancelar Pedido (visible cuando hay ítems) */}
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearCart();
                if (onClose) onClose();
              }}
              style={{
                width: '100%',
                height: '40px',
                borderRadius: '9999px',
                background: '#ffffff',
                border: '1.5px solid #da291c',
                color: '#da291c',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Cancelar Pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
