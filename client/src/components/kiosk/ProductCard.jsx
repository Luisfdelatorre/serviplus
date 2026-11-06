import React, { useState, useRef } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { formatCOP } from '../../utils/format';
import { getProductImageUrl } from '../../utils/productImages';
import { sfx } from '../../utils/audio';
import { ModifierModal } from './ModifierModal';
import './KioskView.css';

export function ProductCard({ item, categoryName }) {
  const cart = useCartStore((state) => state.cart);
  const [imgSrc, setImgSrc] = useState(() => getProductImageUrl(item, categoryName));
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [originRect, setOriginRect] = useState(null);
  const imgWrapRef = useRef(null);

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
        className={`product-card kiosk-product-card ${isSelected ? 'selected' : ''}`}
        onClick={handleCardClick}
      >
        {isSelected && (
          <div className="product-badge-qty kiosk-product-badge-qty">
            {totalItemQty}
          </div>
        )}

        <div className="product-price-badge kiosk-product-price-badge">
          {formatCOP(item.price)}
        </div>

        <div
          ref={imgWrapRef}
          className="product-card-img-wrap kiosk-product-img-wrap"
        >
          {!hasError ? (
            <img
              src={imgSrc}
              alt={item.name}
              className="product-card-img kiosk-product-img"
              onError={handleImgError}
            />
          ) : (
            <div className="kiosk-product-fallback-emoji">🍽️</div>
          )}
        </div>

        <div className="product-card-body kiosk-product-body">
          <div className="product-card-title kiosk-product-title">
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
