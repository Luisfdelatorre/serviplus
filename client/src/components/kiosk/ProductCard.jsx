import React, { useState, useRef } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { formatCOP } from '../../utils/format';
import { getProductImageUrl } from '../../utils/productImages';
import { sfx } from '../../utils/audio';
import { ModifierModal } from './ModifierModal';

export function ProductCard({ item, categoryName }) {
  const cart = useCartStore((state) => state.cart);
  const addToCart = useCartStore((state) => state.addToCart);
  const [imgSrc, setImgSrc] = useState(() => getProductImageUrl(item, categoryName));
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [originRect, setOriginRect] = useState(null);
  const imgWrapRef = useRef(null);

  const hasModifiers = Boolean(item.modifiers && item.modifiers.length > 0);
  const totalItemQty = cart
    .filter((c) => c.id === item.id)
    .reduce((sum, c) => sum + (c.quantity || 1), 0);
  const isSelected = totalItemQty > 0;

  const handleCardClick = () => {
    sfx.playTap();
    if (imgWrapRef.current) {
      const rect = imgWrapRef.current.getBoundingClientRect();
      setOriginRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }
    setIsModalOpen(true);
  };

  const handleImgError = () => {
    if (imgSrc !== '/images/kebab.png') {
      setImgSrc('/images/kebab.png');
    } else {
      setHasError(true);
    }
  };

  return (
    <>
      <div
        className={`product-card ${isSelected ? 'selected' : ''}`}
        onClick={handleCardClick}
        style={{
          background: 'transparent',
          border: isSelected ? '2px solid #f59e0b' : '1px solid transparent',
          borderRadius: '18px',
          padding: '8px 10px 14px 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          cursor: 'pointer',
          boxShadow: isSelected ? '0 4px 16px rgba(245, 158, 11, 0.22)' : 'none',
          position: 'relative',
          minHeight: '175px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {isSelected && (
          <div
            className="product-badge-qty"
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '26px',
              height: '26px',
              padding: '0 6px',
              borderRadius: '9999px',
              background: '#da291c',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(218, 41, 28, 0.45)',
              border: '2px solid #ffffff',
              zIndex: 10
            }}
          >
            {totalItemQty}
          </div>
        )}

        {/* Precio flotante limpio sin borde ni resplandor */}
        <div
          className="product-price-badge"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: '#ffffff',
            borderRadius: '9999px',
            padding: '2px 10px',
            fontWeight: 900,
            fontSize: '0.98rem',
            color: '#000000',
            border: 'none',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
            zIndex: 5,
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap'
          }}
        >
          {formatCOP(item.price)}
        </div>

        {/* Imagen destacada sobre fondo transparente */}
        <div
          ref={imgWrapRef}
          className="product-card-img-wrap"
          style={{
            width: '100%',
            height: '115px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '14px',
            background: 'transparent',
            overflow: 'hidden',
            marginTop: '4px',
            marginBottom: '0px'
          }}
        >
          {!hasError ? (
            <img
              src={imgSrc}
              alt={item.name}
              className="product-card-img"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transition: 'transform 0.3s ease'
              }}
              onError={handleImgError}
            />
          ) : (
            <div style={{ fontSize: '2.5rem' }}>🍽️</div>
          )}
        </div>

        {/* Título centrado */}
        <div className="product-card-body" style={{ width: '100%', textAlign: 'center' }}>
          <div
            className="product-card-title"
            style={{
              fontSize: '1.05rem',
              fontWeight: 400,
              color: '#0f172a',
              lineHeight: 1.25,
              textAlign: 'center',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {item.name}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ModifierModal
          item={item}
          categoryName={categoryName}
          isOpen={isModalOpen}
          originRect={originRect}
          onClose={() => {
            setIsModalOpen(false);
            setOriginRect(null);
          }}
        />
      )}
    </>
  );
}
