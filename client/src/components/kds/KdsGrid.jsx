import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useKdsStore, getOrderKdsStatus } from '../../store/useKdsStore';
import { useMenuStore } from '../../store/useMenuStore';
import { fetchActiveOrders, fetchMenu } from '../../api';
import { KdsTopBar } from './KdsTopBar';
import { KdsCard } from './KdsCard';
import { getElapsedMinutes } from '../../utils/format';
import { useI18n } from '../../i18n';
import { enterFullscreen } from '../../utils/fullscreen';
import { usePixelShift } from '../../utils/usePixelShift';
import { ScreenResolutionBadge } from '../common/ScreenResolutionBadge';
import './KdsView.css';

export function KdsGrid() {
  const { station } = useParams();
  const activeOrders = useKdsStore((state) => state.activeOrders);
  const setActiveOrders = useKdsStore((state) => state.setActiveOrders);
  const setCategories = useMenuStore((state) => state.setCategories);
  const kdsFilter = useKdsStore((state) => state.kdsFilter);
  const kdsPage = useKdsStore((state) => state.kdsPage);
  const setKdsPage = useKdsStore((state) => state.setKdsPage);
  const kdsScale = useKdsStore((state) => state.kdsScale);
  const kdsAutoFit = useKdsStore((state) => state.kdsAutoFit);
  const kdsTheme = useKdsStore((state) => state.kdsTheme);
  const { t } = useI18n();
  const { shiftClass } = usePixelShift();

  // Garantizar que cada vez que se monte o recargue el KDS se obtenga la última versión fresca de productos y órdenes
  useEffect(() => {
    fetchActiveOrders()
      .then((orders) => {
        if (orders) setActiveOrders(orders);
      })
      .catch((err) => console.warn('[KdsGrid] Error loading fresh active orders:', err));

    fetchMenu()
      .then((menu) => {
        if (menu) setCategories(menu);
      })
      .catch((err) => console.warn('[KdsGrid] Error loading fresh menu products:', err));
  }, [setActiveOrders, setCategories]);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-kds-theme', kdsTheme);
    } catch (e) {}
  }, [kdsTheme]);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Asegurar Pantalla Completa siempre en el KDS
  useEffect(() => {
    enterFullscreen();

    const handleFirstGesture = () => {
      enterFullscreen();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const validOrders = (activeOrders || [])
    .filter((o) => o.status !== '3')
    .filter((o) => {
      const kitchenItems = (o.items || []).filter((it) => it.isKitchenItem !== false);
      return kitchenItems.length > 0;
    });

  const prepOrders = validOrders
    .filter((o) => getOrderKdsStatus(o) === 'PREPARING')
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return tA - tB;
    });

  const MAX_READY_MINUTES = 10 * 60;
  const readyOrders = validOrders
    .filter((o) => {
      if (getOrderKdsStatus(o) !== 'READY') return false;
      const elapsed = getElapsedMinutes(o.createdAt);
      return elapsed <= MAX_READY_MINUTES;
    })
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return (tB - tA) || (b.id - a.id);
    });

  const ordersToShow = kdsFilter === 'READY' ? readyOrders : prepOrders;

  const isUltraWide = windowWidth >= 1800;
  let pageSize = 8;
  if (kdsAutoFit) {
    if (kdsScale === 'compact') {
      pageSize = isUltraWide ? 18 : 14;
    } else if (kdsScale === 'large') {
      pageSize = isUltraWide ? 12 : 9;
    } else {
      pageSize = isUltraWide ? 15 : 12;
    }
  } else {
    if (kdsScale === 'compact') {
      pageSize = isUltraWide ? 12 : 10;
    } else if (kdsScale === 'large') {
      pageSize = isUltraWide ? 8 : 6;
    } else {
      pageSize = isUltraWide ? 10 : 8;
    }
  }

  const totalPages = Math.max(1, Math.ceil(ordersToShow.length / pageSize));
  if (kdsPage > totalPages) {
    setKdsPage(1);
  }

  const pagedOrders = ordersToShow.slice((kdsPage - 1) * pageSize, kdsPage * pageSize);

  const containerClasses = [
    'kds-grid',
    `scale-${kdsScale}`,
    kdsAutoFit ? 'autofit-active' : '',
    shiftClass
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`view-section active kds-view-root kds-theme-${kdsTheme}`}
      data-kds-theme={kdsTheme}
    >
      {/* Barra superior de cocina */}
      <KdsTopBar
        prepCount={prepOrders.length}
        readyCount={readyOrders.length}
        totalPages={totalPages}
      />

      {/* Indicador de resolución del televisor en la esquinita */}
      <ScreenResolutionBadge position="bottom-right" />

      {/* Contenedor principal de tarjetas con protección de pantalla */}
      <div className={`kds-container kds-theme-${kdsTheme}`}>
        {ordersToShow.length === 0 ? (
          <div className="kds-empty-state">
            <span className="kds-empty-emoji">👨‍🍳</span>
            <span>{kdsFilter === 'READY' ? t('kds_empty_ready') : t('kds_empty_prep')}</span>
            <span className="kds-empty-subtext">
              Cocina al día • Esperando nuevos pedidos
            </span>
          </div>
        ) : (
          <div className={containerClasses} id="kds-orders-grid">
            {pagedOrders.map((order) => (
              <KdsCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
