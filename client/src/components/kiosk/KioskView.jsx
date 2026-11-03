import React, { useState, useEffect } from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { useCartStore } from '../../store/useCartStore';
import { useKdsStore } from '../../store/useKdsStore';
import { formatCOP } from '../../utils/format';
import { ProductCard } from './ProductCard';
import { CartDrawer } from './CartDrawer';
import { CheckoutModal } from './CheckoutModal';
import { AttractScreen } from './AttractScreen';
import { sfx } from '../../utils/audio';
import { getCategoryImageUrl, getCategoryIcon } from '../../utils/productImages';
import { enterFullscreen, exitFullscreen } from '../../utils/fullscreen';
import './KioskView.css';

function getCategorySubtitle(catName = '') {
  const n = (catName || '').toLowerCase();
  if (n.includes('kebab')) return 'Pan pita recién horneado, vegetales frescos de temporada y salsas secretas';
  if (n.includes('ranchero') || n.includes('carne')) return 'Cortes tiernos asados a fuego lento con el sazón tradicional de la casa';
  if (n.includes('shawarma')) return 'Envueltos artesanales preparados en pan árabe con hierbas y especias';
  if (n.includes('promo') || n.includes('combo')) return 'Las mejores combinaciones con papas crujientes y bebida fría al mejor precio';
  if (n.includes('bebida') || n.includes('jugo')) return 'Refrescantes gaseosas, jugos naturales y té helado para acompañar tu platillo';
  return 'Pan pita recién horneado, vegetales frescos de temporada y salsas artesanales';
}

export function KioskView() {
  const categories = useMenuStore((state) => state.categories);
  const selectedCategory = useMenuStore((state) => state.selectedCategory);
  const setSelectedCategory = useMenuStore((state) => state.setSelectedCategory);
  const searchQuery = useMenuStore((state) => state.searchQuery);
  const setSearchQuery = useMenuStore((state) => state.setSearchQuery);
  const isKioskFullscreen = useMenuStore((state) => state.isKioskFullscreen);
  const setKioskFullscreen = useMenuStore((state) => state.setKioskFullscreen);

  const cart = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAttractActive, setIsAttractActive] = useState(true);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const total = getTotalAmount();
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const IDLE_TIMEOUT_SECONDS = 90; // 1.5 minutos de inactividad para reiniciar
  const WARNING_SECONDS = 15; // Aviso 15s antes

  // Detección de inactividad
  useEffect(() => {
    if (isAttractActive) return;

    const resetTimer = () => {
      setIdleSeconds(0);
      setShowIdleWarning(false);
    };

    const events = ['mousedown', 'mousemove', 'touchstart', 'touchmove', 'keydown', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      setIdleSeconds((prev) => {
        const next = prev + 1;
        if (cart.length > 0 && next >= (IDLE_TIMEOUT_SECONDS - WARNING_SECONDS) && next < IDLE_TIMEOUT_SECONDS) {
          setShowIdleWarning(true);
        }
        if (next >= IDLE_TIMEOUT_SECONDS) {
          clearCart();
          setIsCheckoutOpen(false);
          setIsCartOpen(false);
          setShowIdleWarning(false);
          setIsAttractActive(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isAttractActive, cart.length, clearCart]);

  const activeOrders = useKdsStore((state) => state.activeOrders);
  const preparingCount = activeOrders.filter((o) => o.kdsStatus !== 'SERVED').length;
  const estimatedWaitMins = Math.max(5, Math.min(15, 5 + preparingCount * 2));

  const [currentTime, setCurrentTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const [subFilter, setSubFilter] = useState('all');

  // Iniciar siempre en Recomendados sin ninguna categoría seleccionada al entrar al quiosco
  useEffect(() => {
    setSelectedCategory(null);
  }, [setSelectedCategory]);

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleFullscreen = () => {
    sfx.playTap();
    if (!document.fullscreenElement) {
      enterFullscreen();
      setKioskFullscreen(true);
    } else {
      exitFullscreen();
      setKioskFullscreen(false);
    }
  };

  // Recopilar todos los productos para seleccionar Recomendados
  const allProducts = categories.flatMap((c) =>
    (c.items || []).map((item) => ({ ...item, categoryName: c.name }))
  );

  // Platillos recomendados iniciales (especialidades destacadas)
  const recommendedItems = (() => {
    if (allProducts.length === 0) return [];
    const featured = allProducts.filter(
      (i) =>
        i.isFeatured ||
        i.recommended ||
        (i.name &&
          (i.name.toLowerCase().includes('especial') ||
            i.name.toLowerCase().includes('combo') ||
            i.name.toLowerCase().includes('mixto') ||
            i.name.toLowerCase().includes('pollo')))
    );
    if (featured.length >= 6) return featured.slice(0, 9);
    const picks = [];
    categories.forEach((cat) => {
      (cat.items || []).slice(0, 2).forEach((it) => {
        picks.push({ ...it, categoryName: cat.name });
      });
    });
    return picks.length > 0 ? picks : allProducts.slice(0, 9);
  })();

  const currentCat = selectedCategory ? categories.find((c) => c.name === selectedCategory) : null;
  let items = currentCat ? (currentCat.items || []) : recommendedItems;

  if (searchQuery.trim()) {
    items = allProducts.filter((i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  } else if (subFilter === 'clasicos') {
    const filtered = items.filter(
      (i) => !i.name.toLowerCase().includes('especial') && !i.name.toLowerCase().includes('mixto')
    );
    if (filtered.length > 0) items = filtered;
  } else if (subFilter === 'especiales') {
    const filtered = items.filter(
      (i) => i.name.toLowerCase().includes('especial') || i.name.toLowerCase().includes('mixto')
    );
    if (filtered.length > 0) items = filtered;
  }

  const handleCatClick = (name) => {
    sfx.playTap();
    if (selectedCategory === name) {
      // Si pulsa la misma categoría activa, regresa a la vista de Recomendados
      setSelectedCategory(null);
    } else {
      setSelectedCategory(name);
    }
    setSearchQuery('');
    setSubFilter('all');
  };

  return (
    <div className={`view-section active kiosk-view-viewport ${isKioskFullscreen ? 'is-fullscreen' : ''}`}>
      {/* 1. TOP STATUS BAR (Barra superior para presencia en pantalla completa estilo quiosco) */}
      <header className="kiosk-top-status-bar">
        {/* Izquierda: Indicador y Pill de Terminal Activo */}
        <div className="kiosk-status-left">
          <span className="kiosk-status-dot-dim" />
          <div className="kiosk-status-terminal-pill">
            <span className="kiosk-status-dot-live" />
            <span>Kiosco T-04 Activo</span>
          </div>
        </div>

        {/* Derecha: Tiempo estimado de espera y reloj / controles */}
        <div className="kiosk-status-right">
          <div className="kiosk-status-wait-pill">
            <span className="kiosk-status-wait-icon">⏱️</span>
            <span>Espera aprox: {estimatedWaitMins} min</span>
          </div>

          <span className="kiosk-status-clock">{currentTime}</span>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isKioskFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="kiosk-status-fs-btn"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {isKioskFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. LAYOUT: SIDEBAR CATEGORÍAS + CATÁLOGO */}
      <div className="kiosk-layout-grid">
        {/* Columna 1: Categorías Verticales con Fotos Circulares */}
        <aside className="kiosk-categories-aside">
          {categories.map((cat) => {
            const isActive = Boolean(selectedCategory && selectedCategory === cat.name && !searchQuery);
            return (
              <button
                key={cat.id || cat.name}
                type="button"
                className={`kiosk-cat-button ${isActive ? 'active' : ''}`}
                onClick={() => handleCatClick(cat.name)}
              >
                {/* Thumbnail circular con imagen real */}
                <div className="kiosk-cat-thumb-box">
                  <img
                    src={getCategoryImageUrl(cat.name)}
                    alt={cat.name}
                    className="kiosk-cat-thumb-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <span className="kiosk-cat-thumb-fallback">{getCategoryIcon(cat.name)}</span>
                </div>

                <span className="kiosk-cat-name">{cat.name}</span>
              </button>
            );
          })}
        </aside>

        {/* Columna 2: Catálogo de Platillos & Subheader */}
        <section className="kiosk-catalog-section">
          {/* Banner Fotográfico del Restaurante (se oculta con animación suave al elegir categoría) */}
          <div className={`kiosk-restaurant-banner-wrap ${selectedCategory ? 'banner-hidden' : 'banner-visible'}`}>
            <div className="kiosk-restaurant-banner-box">
              <img
                src="/images/kebab_banner.jpg"
                alt="Foto del Restaurante Kebab & Shawarma"
                className="kiosk-restaurant-banner-img"
              />
              <div className="kiosk-restaurant-banner-overlay" />
            </div>
          </div>

          {/* Subheader con Título de Categoría, Subtítulo y Filtros estilo Screenshot */}
          <div className="kiosk-catalog-header-bar">
            <div className="kiosk-catalog-title-group">
              <span className="kiosk-catalog-accent-bar" />
              <div
                key={currentCat ? currentCat.name : 'recomendados'}
                className="kiosk-catalog-titles"
              >
                <h1 className="kiosk-catalog-h1">
                  {currentCat ? currentCat.name : 'Platos Recomendados'}
                </h1>
                <p className="kiosk-catalog-subtitle">
                  {currentCat
                    ? getCategorySubtitle(currentCat.name)
                    : 'Nuestras especialidades más pedidas de la cocina preparadas al momento'}
                </p>
              </div>
            </div>


          </div>

          {/* Grilla de Platillos */}
          <div className={`kiosk-catalog-products-stage ${totalItems > 0 ? 'has-cart' : ''}`}>
            <div className="kiosk-products-grid">
              {items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  categoryName={item.categoryName || currentCat?.name}
                />
              ))}
            </div>

            {items.length === 0 && (
              <div className="kiosk-empty-products">
                <div className="kiosk-empty-icon">🔍</div>
                <div className="kiosk-empty-title">No se encontraron productos</div>
                <p className="kiosk-empty-desc">
                  Prueba seleccionando otra subcategoría o categoría
                </p>
              </div>
            )}
          </div>

          {/* Barra Flotante Inferior Estilo McDonald's */}
          {totalItems > 0 && (
            <div className="kiosk-mcd-bottom-anchor">
              <div
                onClick={() => {
                  sfx.playTap();
                  setIsCheckoutOpen(true);
                }}
                className="kiosk-mcd-bottom-bar"
              >
                {/* Lado Izquierdo: Badge Circular + Título y Cantidad */}
                <div className="kiosk-mcd-left">
                  <div className="kiosk-mcd-qty-circle">
                    {totalItems}
                  </div>

                  <div className="kiosk-mcd-text-group">
                    <span className="kiosk-mcd-title">Mi pedido</span>
                    <span className="kiosk-mcd-subtitle">
                      {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </div>
                </div>

                {/* Lado Derecho: Total en Grande + "Revisar pedido >" */}
                <div className="kiosk-mcd-right">
                  <span className="kiosk-mcd-total-price">
                    {formatCOP(total)}
                  </span>
                  <span className="kiosk-mcd-review-action">
                    Revisar pedido
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Drawer Deslizable de Carrito (Revisar Pedido) */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Modal de Checkout */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCompleted={() => {
          setIsCheckoutOpen(false);
          setIsAttractActive(true);
        }}
      />

      {/* Modal de Advertencia por Inactividad (15s antes del reset) */}
      {showIdleWarning && (
        <div className="kiosk-idle-modal-backdrop">
          <div className="kiosk-idle-modal-card">
            <div className="kiosk-idle-emoji">⏰</div>
            <h3 className="kiosk-idle-title">¿Sigues ahí?</h3>
            <p className="kiosk-idle-desc">
              Tu pedido se reiniciará en{' '}
              <strong className="kiosk-idle-highlight">
                {IDLE_TIMEOUT_SECONDS - idleSeconds}s
              </strong>{' '}
              por inactividad.
            </p>
            <button
              type="button"
              onClick={() => {
                sfx.playTap();
                setIdleSeconds(0);
                setShowIdleWarning(false);
              }}
              className="kiosk-idle-continue-btn"
            >
              ¡Continuar con mi Orden!
            </button>
          </div>
        </div>
      )}

      {/* TAP TO START Entry Banner Attract Screen */}
      {isAttractActive && (
        <AttractScreen
          onStart={() => {
            setIsAttractActive(false);
            setIdleSeconds(0);
            setSelectedCategory(null);
            setSubFilter('all');
            setSearchQuery('');
          }}
        />
      )}
    </div>
  );
}
