import React from 'react';
import { formatCOP } from '../../../utils/format';
import { getProductImageUrl } from '../../../utils/productImages';

export function ReviewStep({
  cart = [],
  total = 0,
  totalItems = 0,
  updateQuantity,
  removeFromCart,
  clearCart,
  onNext,
  onAddMore
}) {
  return (
    <div className="checkout-step-page animate-step-fade">
      {/* Barra de Título */}
      <div className="checkout-section-header">
        <div>
          <h2 className="checkout-title-h2">Revisar Mi Pedido</h2>
          <p className="checkout-subtitle-p">
            Verifica tus platillos, añade salsas o modifica cantidades antes de pagar
          </p>
        </div>

        <div className="checkout-header-actions-group">
          <span className="checkout-badge-pill">
            {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
          </span>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Deseas vaciar tu pedido por completo?')) {
                  clearCart();
                }
              }}
              className="checkout-clear-btn"
            >
              🗑️ Vaciar todo
            </button>
          )}
        </div>
      </div>

      {/* Lista Scrollable de Productos */}
      <div className="checkout-items-container">
        {cart.map((item) => {
          const itemKey = item.cartItemId || item.id;
          return (
            <div key={itemKey} className="checkout-item-card">
              {/* Imagen Thumbnail */}
              <div className="checkout-item-img-wrap">
                <img
                  src={getProductImageUrl(item)}
                  alt={item.name}
                  className="checkout-item-img"
                  onError={(e) => {
                    e.currentTarget.src = '/images/kebab.png';
                  }}
                />
              </div>

              {/* Info y Modificadores */}
              <div className="checkout-item-info">
                <div className="checkout-item-name">{item.name}</div>

                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="checkout-item-mods">
                    {item.modifiers.map((m, idx) => (
                      <span key={idx} className="checkout-mod-pill">
                        + {m.name}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <div className="checkout-item-notes">📝 {item.notes}</div>
                )}

                <div className="checkout-item-price">
                  {formatCOP(item.price * item.quantity)}
                </div>
              </div>

              {/* Controles de Cantidad */}
              <div className="checkout-qty-group">
                <button
                  type="button"
                  onClick={() => updateQuantity(itemKey, -1)}
                  className="checkout-qty-btn"
                >
                  -
                </button>
                <span className="checkout-qty-text">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(itemKey, 1)}
                  className="checkout-qty-btn plus"
                >
                  +
                </button>

                {/* Botón Papelera */}
                <button
                  type="button"
                  onClick={() => removeFromCart && removeFromCart(itemKey)}
                  className="checkout-item-del-btn"
                  title="Eliminar plato"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}

        {cart.length === 0 && (
          <div className="checkout-empty-cart">
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🥙</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#334155' }}>
              Tu orden está vacía
            </div>
            <p style={{ fontSize: '0.95rem', marginTop: '6px', color: '#64748b' }}>
              Agrega productos del menú para comenzar tu pedido.
            </p>
          </div>
        )}
      </div>

      {/* Footer Fijo con Total y Botón Continuar */}
      <div className="checkout-footer-bar">
        <div>
          <div className="checkout-footer-total-lbl">TOTAL DE TU ORDEN</div>
          <div className="checkout-footer-total-val">{formatCOP(total)}</div>
        </div>

        <div className="checkout-footer-actions">
          <button type="button" onClick={onAddMore} className="checkout-btn-add-more">
            + Agregar Más Productos
          </button>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onNext}
            className={`checkout-btn-primary-action ${cart.length > 0 ? 'pulse-primary-btn' : ''}`}
          >
            <span>Elegir Dónde Comer →</span>
          </button>
        </div>
      </div>
    </div>
  );
}

