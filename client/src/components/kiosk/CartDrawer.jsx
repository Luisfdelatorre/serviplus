import React, { useRef, useEffect } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { formatCOP } from '../../utils/format';
import './KioskView.css';

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
      className="cart-drawer-overlay cdrw-s-1"
      onClick={onClose}
    >
      <div
        className="cart-drawer-slide cdrw-s-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Mi Pedido */}
        <div
          className="cart-header cdrw-s-3"
        >
          <div className="cdrw-s-4">
            <div className="cdrw-s-5">
              <span className="cdrw-s-6">
                Mi Pedido
              </span>
              <span
                className="cdrw-s-7"
              >
                {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            {/* Botón Cerrar Drawer */}
            <button
              type="button"
              onClick={onClose}
              className="cdrw-s-8"
              title="Volver al menú"
            >
              ✕
            </button>
          </div>

          {/* Toggle Comer Aquí / Para Llevar */}
          <div className="cdrw-s-9">
            <button
              type="button"
              onClick={() => setOrderType && setOrderType('DINE_IN')}
              className={`cdrw-order-type-btn ${orderType === 'DINE_IN' ? 'active' : ''}`}
            >
              🍽️ Comer Aquí
            </button>
            <button
              type="button"
              onClick={() => setOrderType && setOrderType('TAKE_OUT')}
              className={`cdrw-order-type-btn ${orderType === 'TAKE_OUT' ? 'active' : ''}`}
            >
              🥡 Para Llevar
            </button>
          </div>
        </div>

        {/* Items List */}
        <div
          ref={cartListRef}
          className="cart-items-list cdrw-s-10"
        >
          {cart.map((item) => {
            const itemKey = item.cartItemId || item.id;
            return (
              <div
                key={itemKey}
                className="cart-item-row cdrw-s-11"
              >
                <div className="cdrw-s-12">
                  <div className="cdrw-s-13">
                    {item.name}
                  </div>

                  {/* Modificadores seleccionados */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div
                      className="cdrw-s-14"
                    >
                      + {item.modifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}

                  {/* Notas especiales */}
                  {item.notes && (
                    <div
                      className="cdrw-s-15"
                    >
                      📝 {item.notes}
                    </div>
                  )}

                  <div className="cdrw-s-16">
                    {formatCOP(item.price * item.quantity)}
                  </div>
                </div>

                {/* Controles de cantidad */}
                <div className="cdrw-s-17">
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, -1)}
                    className="cdrw-s-18"
                  >
                    -
                  </button>
                  <span className="cdrw-s-19">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, 1)}
                    className="cdrw-s-20"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div
              className="cdrw-s-21"
            >
              <div className="cdrw-s-22">🥙</div>
              <div className="cdrw-s-23">
                Tu orden está vacía
              </div>
              <p className="cdrw-s-24">
                Selecciona productos del menú para comenzar.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="cdrw-s-25"
              >
                Volver al Menú
              </button>
            </div>
          )}
        </div>

        {/* Footer Fijo Total & Botones */}
        <div
          className="cart-footer cdrw-s-26"
        >
          <div className="cdrw-s-4">
            <span className="cdrw-s-27">
              Total a Pagar:
            </span>
            <span className="cdrw-s-28">
              {formatCOP(total)}
            </span>
          </div>

          {/* Botón Finalizar y Pagar */}
          <button
            type="button"
            className={`cart-checkout-btn cdrw-checkout-btn ${cart.length > 0 ? 'has-items' : ''}`}
            disabled={cart.length === 0}
            onClick={() => {
              if (onClose) onClose();
              if (onCheckout) onCheckout();
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
              className="cdrw-s-29"
            >
              Cancelar Pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
