import React, { useState, useRef, useLayoutEffect } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { formatCOP } from '../../utils/format';
import { getProductImageUrl } from '../../utils/productImages';
import { sfx } from '../../utils/audio';
import './ModifierModal.css';

function getModifierEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('queso') || n.includes('cheese')) return '🧀';
  if (n.includes('huevo') || n.includes('egg')) return '🍳';
  if (n.includes('chorizo') || n.includes('salchicha') || n.includes('meat') || n.includes('carne')) return '🥩';
  if (n.includes('tocino') || n.includes('bacon')) return '🥓';
  if (n.includes('jalape') || n.includes('picante') || n.includes('chili')) return '🌶️';
  if (n.includes('maiz') || n.includes('corn')) return '🌽';
  if (n.includes('papa') || n.includes('fry') || n.includes('frita')) return '🍟';
  if (n.includes('cebolla') || n.includes('onion')) return '🧅';
  if (n.includes('tomate') || n.includes('tomato')) return '🍅';
  if (n.includes('salsa') || n.includes('sauce') || n.includes('mayo') || n.includes('ajo')) return '🥣';
  if (n.includes('champin') || n.includes('hongo')) return '🍄';
  if (n.includes('aguacate') || n.includes('guacamol')) return '🥑';
  if (n.includes('pollo') || n.includes('chicken')) return '🍗';
  return '✨';
}

function getItemNutrition(item, categoryName = '') {
  const name = (item.name || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();

  if (name.includes('combo') || name.includes('familiar')) {
    return {
      calories: '980',
      protein: '45g',
      fats: '36g',
      allergens: 'Contiene gluten, lácteos y sésamo. Preparado en línea con trazas de frutos secos.'
    };
  }
  if (name.includes('bebida') || name.includes('jugo') || name.includes('gaseosa') || cat.includes('bebida')) {
    return {
      calories: '140',
      protein: '0g',
      fats: '0g',
      allergens: 'Sin alérgenos comunes.'
    };
  }
  if (name.includes('papa') || name.includes('frita') || name.includes('aro')) {
    return {
      calories: '380',
      protein: '5g',
      fats: '18g',
      allergens: 'Contiene gluten. Frito en aceite vegetal compartido.'
    };
  }
  return {
    calories: '640',
    protein: '34g',
    fats: '22g',
    allergens: 'Contiene gluten, lácteos y sésamo. Preparado en línea con trazas de frutos secos.'
  };
}

export function ModifierModal({ item, categoryName, isOpen, onClose, onAdd, originRect }) {
  if (!isOpen || !item) return null;

  const addToCart = useCartStore((state) => state.addToCart);

  // Vistas: 'hero' (versión grande de exhibición con Listo / Personalizar), 'customize' (adicionales y salsas), 'summary'
  const [view, setView] = useState('hero');
  const [showNutrition, setShowNutrition] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const heroImgRef = useRef(null);

  // Coordenadas relativas del punto de origen del clic para la explosión del modal
  const originPercentX = originRect
    ? Math.min(88, Math.max(12, Math.round(((originRect.left + originRect.width / 2) / (window.innerWidth || 1024)) * 100)))
    : 50;
  const originPercentY = originRect
    ? Math.min(88, Math.max(12, Math.round(((originRect.top + originRect.height / 2) / (window.innerHeight || 768)) * 100)))
    : 50;

  // Animación de crecimiento zoom agresivo desde la posición física del producto en el catálogo
  useLayoutEffect(() => {
    if (!originRect || !heroImgRef.current || view !== 'hero') return;

    const imgEl = heroImgRef.current;
    const targetRect = imgEl.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) return;

    // Calcular desplazamiento delta desde la posición del card hasta el modal
    const deltaX = (originRect.left + originRect.width / 2) - (targetRect.left + targetRect.width / 2);
    const deltaY = (originRect.top + originRect.height / 2) - (targetRect.top + targetRect.height / 2);
    const scale = Math.max(0.2, originRect.width / targetRect.width);

    // Posición inicial: exactamente encima del producto en el catálogo
    imgEl.style.transition = 'none';
    imgEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`;
    imgEl.style.zIndex = '999';

    // Forzar reflow del navegador para garantizar que la posición inicial tome efecto antes de pintar
    void imgEl.offsetHeight;

    // Disparar animación agresiva de crecimiento hacia el centro
    requestAnimationFrame(() => {
      imgEl.style.transition = 'transform 0.44s cubic-bezier(0.18, 1.35, 0.32, 1)';
      imgEl.style.transform = 'translate3d(0, 0, 0) scale(1)';
    });

    const timer = setTimeout(() => {
      if (imgEl) {
        imgEl.style.transition = '';
        imgEl.style.transform = '';
        imgEl.style.zIndex = '';
      }
    }, 460);

    return () => clearTimeout(timer);
  }, [originRect]);

  // Separar modificadores en salsas/ingredientes base (costo 0) y extras (costo > 0)
  const allModifiers = item.modifiers || [];
  const baseModifiers = allModifiers.filter((m) => !m.price || Number(m.price) === 0);
  const extraModifiers = allModifiers.filter((m) => m.price && Number(m.price) > 0);

  // Estados locales de selección
  const [selectedModIds, setSelectedModIds] = useState(() => new Set());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const toggleModifier = (mod) => {
    sfx.playTap();
    setSelectedModIds((prev) => {
      const next = new Set(prev);
      if (next.has(mod.id)) {
        next.delete(mod.id);
      } else {
        next.add(mod.id);
      }
      return next;
    });
  };

  const toggleInstructionPill = (text) => {
    sfx.playTap();
    setNotes((prev) => {
      const current = prev.trim();
      if (!current) return text;
      if (current.includes(text)) {
        return current
          .replace(new RegExp(`\\b${text}\\b,?`, 'g'), '')
          .replace(/,\s*$/, '')
          .trim();
      }
      return `${current}, ${text}`;
    });
  };

  const selectedModsList = allModifiers.filter((m) => selectedModIds.has(m.id));
  const selectedExtrasList = selectedModsList.filter((m) => m.price && Number(m.price) > 0);
  const selectedBaseList = selectedModsList.filter((m) => !m.price || Number(m.price) === 0);

  const extrasCost = selectedModsList.reduce((sum, m) => sum + (Number(m.price) || 0), 0);
  const basePriceNum = Number(item.price) || 0;
  const unitPriceWithMods = basePriceNum + extrasCost;
  const totalPrice = unitPriceWithMods * quantity;

  const handleConfirmAndAdd = () => {
    sfx.playReadyChime();
    setToastMessage(`${quantity}x ${item.name} agregado al pedido`);

    const itemData = {
      ...item,
      basePrice: basePriceNum,
      price: unitPriceWithMods,
      modifiers: selectedModsList,
      notes: notes.trim(),
      quantity: quantity
    };

    setTimeout(() => {
      if (onAdd) {
        onAdd(itemData);
      } else {
        addToCart(itemData);
      }
      onClose();
    }, 380);
  };

  const imgSrc = getProductImageUrl(item, categoryName);
  const nutrition = getItemNutrition(item, categoryName);
  const hasCustomizations = selectedModsList.length > 0 || Boolean(notes.trim());

  return (
    <div className="kiosk-scrim-backdrop" onClick={onClose}>
      {/* TARJETA MODAL APAISADA (HORIZONTAL KIOSK DESIGN) */}
      <section
        className={`kiosk-landscape-card ${view === 'customize' ? 'view-customize' : 'view-hero'}`}
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="product-modal-title"
      >
        {/* ============================================================== */}
        {/* CASO 1: VISTA HERO (PRODUCTO EN GRANDE ESTILO MCDONALD'S KIOSK) */}
        {/* ============================================================== */}
        {view === 'hero' && (
          <>
            {/* Barra superior de anclajes táctiles */}
            <header className="kiosk-card-header">
              <div className="kiosk-header-left-badge">
                <span className="kiosk-card-badge">
                  <span className="kiosk-card-badge-dot" />
                  Plato Estrella • {categoryName || 'Especialidades'}
                </span>
              </div>

              {/* Botón táctil circular de cierre centrado */}
              <button
                type="button"
                id="btn-close-modal"
                aria-label="Cerrar ventana"
                className="kiosk-btn-close-tactile"
                onClick={() => {
                  sfx.playTap();
                  onClose();
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              {/* Botón de Información Nutricional */}
              <div className="kiosk-header-right-action">
                <button
                  type="button"
                  id="btn-info-dialog"
                  aria-label="Información Nutricional"
                  className="kiosk-btn-info-tactile"
                  onClick={() => {
                    sfx.playTap();
                    setShowNutrition(true);
                  }}
                >
                  <span className="material-symbols-outlined">info</span>
                </button>
              </div>
            </header>

            {/* Escenario Principal del Producto (2 Columnas Landscape Split) */}
            <div className="kiosk-card-stage">
              {/* Columna Izquierda: Vitrina Fotográfica Hero en Grande */}
              <div className="kiosk-stage-photo-col">
                {/* Halo radial luminoso para abrir el apetito */}
                <div className="kiosk-stage-halo" />
                <div className="kiosk-stage-img-wrap">
                  <img
                    ref={heroImgRef}
                    src={imgSrc}
                    alt={item.name}
                    className="kiosk-stage-img"
                    onError={(e) => {
                      if (e.target.src !== '/images/kebab.png') {
                        e.target.src = '/images/kebab.png';
                      }
                    }}
                  />
                </div>
              </div>

              {/* Columna Derecha: Configuración detallada y Controles Táctiles */}
              <div className="kiosk-stage-info-col">
                <div className="kiosk-stage-tagline">
                  <span className="material-symbols-outlined mmod-s-1">
                    stars
                  </span>
                  Recomendado del Chef
                </div>

                <h1 className="kiosk-stage-title" id="product-modal-title">
                  {item.name}
                </h1>

                {/* Precio Hero en Ámbar Dorado con desglose si tiene extras */}
                <div className="kiosk-stage-price-row">
                  <span className="kiosk-stage-price" id="price-display-val">
                    {formatCOP(totalPrice)}
                  </span>
                  <div className="kiosk-stage-price-detail">
                    <span className="kiosk-stage-tax">IVA incluido</span>
                    {extrasCost > 0 && (
                      <span className="kiosk-stage-unit-breakdown">
                        ({formatCOP(basePriceNum)} base + {formatCOP(extrasCost)} extras{quantity > 1 ? ` × ${quantity}` : ''})
                      </span>
                    )}
                  </div>
                </div>

                {/* Descripción apetitosa */}
                <p className="kiosk-stage-desc">
                  {item.description ||
                    'Pan pita artesanal crujiente relleno con tiernas láminas de carne adobada a fuego lento, vegetales frescos de temporada y selección de salsas caseras.'}
                </p>

                {/* Resumen completo de adicionales y notas si ya personalizó */}
                {hasCustomizations && (
                  <div className="kiosk-hero-customization-summary">
                    <div className="kiosk-summary-header">
                      <span className="kiosk-summary-title">
                        <span className="material-symbols-outlined mmod-s-2">
                          check_circle
                        </span>
                        Personalización ({selectedModsList.length + (notes.trim() ? 1 : 0)}):
                      </span>
                      {extrasCost > 0 && (
                        <span className="kiosk-summary-extra-cost">+{formatCOP(extrasCost)} c/u</span>
                      )}
                    </div>

                    {/* Extras con costo */}
                    {selectedExtrasList.length > 0 && (
                      <div className="kiosk-summary-row">
                        <span className="kiosk-summary-row-label">Adicionales:</span>
                        <div className="kiosk-summary-chips">
                          {selectedExtrasList.map((ext) => (
                            <span key={ext.id} className="kiosk-summary-chip extra-chip">
                              {getModifierEmoji(ext.name)} {ext.name} <strong>+{formatCOP(ext.price)}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Salsas base */}
                    {selectedBaseList.length > 0 && (
                      <div className="kiosk-summary-row">
                        <span className="kiosk-summary-row-label">Salsas:</span>
                        <div className="kiosk-summary-chips">
                          {selectedBaseList.map((b) => (
                            <span key={b.id} className="kiosk-summary-chip base-chip">
                              {getModifierEmoji(b.name)} {b.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notas de cocina */}
                    {notes.trim() && (
                      <div className="kiosk-summary-row">
                        <span className="kiosk-summary-row-label">Cocina:</span>
                        <span className="kiosk-summary-notes">📝 "{notes.trim()}"</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Selector Táctil Ergonómico de Cantidad (48px+ Hit Targets) */}
                <div className="kiosk-stage-stepper-wrap">
                  <span className="kiosk-stage-stepper-label">Cantidad:</span>
                  <div className="kiosk-stage-stepper-box">
                    <button
                      type="button"
                      id="qty-minus"
                      aria-label="Disminuir cantidad"
                      className="kiosk-stepper-touch-btn kiosk-stepper-touch-minus"
                      onClick={() => {
                        sfx.playTap();
                        setQuantity((q) => Math.max(1, q - 1));
                      }}
                    >
                      <span className="material-symbols-outlined">remove</span>
                    </button>

                    <span className="kiosk-stepper-touch-val" id="qty-value">
                      {quantity}
                    </span>

                    <button
                      type="button"
                      id="qty-plus"
                      aria-label="Aumentar cantidad"
                      className="kiosk-stepper-touch-btn kiosk-stepper-touch-plus"
                      onClick={() => {
                        sfx.playTap();
                        setQuantity((q) => q + 1);
                      }}
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>

                {/* Botones de Acción Dual (Estilo McDonald's Squircles) */}
                <div className={`kiosk-stage-actions-row ${allModifiers.length === 0 ? 'single-action' : ''}`}>
                  {allModifiers.length > 0 && (
                    <button
                      type="button"
                      id="btn-customize"
                      className="kiosk-btn-stage-customize"
                      onClick={() => {
                        sfx.playTap();
                        setView('customize');
                      }}
                    >
                      <span className="material-symbols-outlined">tune</span>
                      <span>{hasCustomizations ? 'Modificar extras' : 'Personalizar'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-add-cart"
                    className="kiosk-btn-stage-ready"
                    onClick={handleConfirmAndAdd}
                  >
                    <span className="material-symbols-outlined">shopping_bag</span>
                    <span id="btn-add-label">Listo • {formatCOP(totalPrice)}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* CASO 2: VISTA PERSONALIZAR (SALSAS, EXTRAS Y NOTAS DE COCINA)  */}
        {/* ============================================================== */}
        {view === 'customize' && (
          <div className="kiosk-customize-wrapper">
            <header className="kiosk-customize-header">
              <button
                type="button"
                className="kiosk-customize-back-btn"
                onClick={() => {
                  sfx.playTap();
                  setView('hero');
                }}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Regresar al Producto</span>
              </button>

              <div className="kiosk-customize-title-group">
                <span className="kiosk-customize-category-badge">
                  {categoryName || 'Personalización'}
                </span>
              </div>

              <button
                type="button"
                aria-label="Cerrar ventana"
                className="kiosk-customize-close-btn"
                onClick={() => {
                  sfx.playTap();
                  onClose();
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="kiosk-customize-content">
              {/* Columna Izquierda: Hero Card Compacta */}
              <div className="kiosk-hero-card">
                <div className="kiosk-hero-badges">
                  <span className="kiosk-badge-recommended">
                    <span className="kiosk-badge-dot" />
                    Recomendado
                  </span>
                  <span className="kiosk-badge-calories">🔥 {nutrition.calories} kcal</span>
                </div>

                <div className="kiosk-hero-image-stage">
                  <div className="kiosk-hero-halo" />
                  <img
                    src={imgSrc}
                    alt={item.name}
                    className="kiosk-hero-img"
                    onError={(e) => {
                      if (e.target.src !== '/images/kebab.png') {
                        e.target.src = '/images/kebab.png';
                      }
                    }}
                  />
                </div>

                <h1 className="kiosk-hero-title">{item.name}</h1>
                <p className="kiosk-hero-desc">
                  {item.description ||
                    'Pan pita recién horneado, vegetales frescos, carne marinada al carbón y deliciosa salsa artesanal.'}
                </p>

                <div className="kiosk-base-price-tag">
                  <span className="kiosk-base-price-label">Precio Base:</span>
                  <span className="kiosk-base-price-amount">{formatCOP(basePriceNum)}</span>
                </div>

                {selectedModsList.length > 0 && (
                  <div className="kiosk-selected-extras-preview">
                    <div className="kiosk-selected-extras-heading">
                      Extras elegidos ({selectedModsList.length}):
                    </div>
                    <div className="kiosk-selected-extras-chips">
                      {selectedModsList.map((m) => (
                        <span key={m.id} className="kiosk-selected-chip">
                          {getModifierEmoji(m.name)} {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Opciones y Modificadores */}
              <div className="kiosk-options-column">
                {/* 1. Adicionales y Extras (con costo) */}
                {extraModifiers.length > 0 && (
                  <section className="kiosk-section-card">
                    <div className="kiosk-section-header">
                      <div className="kiosk-section-heading-group">
                        <span className="kiosk-step-number-badge">1</span>
                        <div>
                          <div className="kiosk-section-title-row">
                            <h2 className="kiosk-section-title">Adicionales y Extras</h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="kiosk-extras-grid">
                      {extraModifiers.map((mod) => {
                        const isChecked = selectedModIds.has(mod.id);
                        return (
                          <div
                            key={mod.id}
                            onClick={() => toggleModifier(mod)}
                            className={`kiosk-extra-card ${isChecked ? 'selected' : ''}`}
                          >
                            <div className="kiosk-extra-card-top">
                              <div className="kiosk-extra-info">
                                <span className="kiosk-extra-emoji">{getModifierEmoji(mod.name)}</span>
                                <span className="kiosk-extra-name">{mod.name}</span>
                              </div>
                              <div className={`kiosk-checkbox-indicator ${isChecked ? 'checked' : ''}`}>
                                {isChecked ? '✓' : ''}
                              </div>
                            </div>

                            <div className="kiosk-extra-card-bottom">
                              <span className="kiosk-extra-price">+{formatCOP(mod.price)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. Salsas y Toppings Base (Sin costo) */}
                {baseModifiers.length > 0 && (
                  <section className="kiosk-section-card">
                    <div className="kiosk-section-header">
                      <div className="kiosk-section-heading-group">
                        <span className="kiosk-step-number-badge">2</span>
                        <div>
                          <div className="kiosk-section-title-row">
                            <h2 className="kiosk-section-title">Salsas y Toppings</h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="kiosk-sauces-grid">
                      {baseModifiers.map((mod) => {
                        const isChecked = selectedModIds.has(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => toggleModifier(mod)}
                            className={`kiosk-sauce-btn ${isChecked ? 'selected' : ''}`}
                          >
                            <span className="mmod-s-3">
                              <span>{getModifierEmoji(mod.name)}</span>
                              <span>{mod.name}</span>
                            </span>
                            <span
                              className={`kiosk-checkbox-indicator ${isChecked ? 'checked-green' : ''} mmod-s-4`}
                            >
                              {isChecked ? '✓' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 3. Instrucciones especiales para cocina */}
                <section className="kiosk-section-card">
                  <div className="kiosk-section-header">
                    <div className="kiosk-section-heading-group">
                      <span className="mmod-s-5">📝</span>
                      <div>
                        <h2 className="kiosk-section-title mmod-s-6">
                          Instrucciones especiales para cocina
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="kiosk-pills-row">
                    {['Sin cebolla', 'Bien cocido', 'Salsa aparte', 'Sin vegetales', 'Poco picante'].map(
                      (tag) => {
                        const isActive = notes.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleInstructionPill(tag)}
                            className={`kiosk-instruction-pill ${isActive ? 'active' : ''}`}
                          >
                            {isActive ? '✓ ' : '+ '} {tag}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Escribe notas adicionales para el chef..."
                    className="kiosk-notes-input"
                  />
                </section>
              </div>
            </div>

            {/* Pie de confirmación en la vista de personalización */}
            <footer className="kiosk-customize-footer">
              <div className="kiosk-customize-footer-controls">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playTap();
                    setView('hero');
                  }}
                  className="kiosk-cancel-btn"
                >
                  Regresar
                </button>

                <div className="kiosk-quantity-stepper">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playTap();
                      setQuantity((q) => Math.max(1, q - 1));
                    }}
                    aria-label="Disminuir cantidad"
                    className="kiosk-stepper-btn"
                  >
                    −
                  </button>

                  <span className="kiosk-stepper-value">{quantity}</span>

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playTap();
                      setQuantity((q) => q + 1);
                    }}
                    aria-label="Aumentar cantidad"
                    className="kiosk-stepper-btn"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sfx.playTap();
                  setView('hero');
                }}
                className="kiosk-cta-yellow-btn mmod-s-7"
              >
                <span className="mmod-s-8">
                  <span className="material-symbols-outlined">check</span>
                  <span>Listo • Ver Producto</span>
                </span>
                <span className="kiosk-cta-price-pill">{formatCOP(totalPrice)}</span>
              </button>
            </footer>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL SECUNDARIO: INFORMACIÓN NUTRICIONAL                       */}
        {/* ============================================================== */}
        {showNutrition && (
          <div className="kiosk-nutrition-overlay" onClick={() => setShowNutrition(false)}>
            <div className="kiosk-nutrition-card" onClick={(e) => e.stopPropagation()}>
              <div className="kiosk-nutrition-header">
                <span className="kiosk-nutrition-title">Información Nutricional</span>
                <button
                  type="button"
                  aria-label="Cerrar info"
                  className="kiosk-nutrition-close-btn"
                  onClick={() => setShowNutrition(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="kiosk-nutrition-grid">
                <div className="kiosk-nutrition-stat">
                  <span className="kiosk-stat-val">{nutrition.calories}</span>
                  <span className="kiosk-stat-lbl">Calorías</span>
                </div>
                <div className="kiosk-nutrition-stat">
                  <span className="kiosk-stat-val">{nutrition.protein}</span>
                  <span className="kiosk-stat-lbl">Proteína</span>
                </div>
                <div className="kiosk-nutrition-stat">
                  <span className="kiosk-stat-val">{nutrition.fats}</span>
                  <span className="kiosk-stat-lbl">Grasas</span>
                </div>
              </div>

              <div className="kiosk-nutrition-allergens">
                <strong>Alérgenos:</strong> {nutrition.allergens}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TOAST FEEDBACK DE MICROINTERACCIÓN                             */}
        {/* ============================================================== */}
        {toastMessage && (
          <div className="kiosk-toast-feedback">
            <span className="material-symbols-outlined mmod-s-9">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
      </section>
    </div>
  );
}
