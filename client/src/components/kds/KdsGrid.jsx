import React, { useState, useEffect } from 'react';
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

export function KdsGrid() {
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
  const { style: pixelShiftStyle } = usePixelShift();

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
    // 1. Intentar entrar a pantalla completa de inmediato
    enterFullscreen();

    // 2. Si el navegador requiere interacción previa del usuario (política de seguridad de Chrome/Edge),
    // el primer toque o clic en cualquier parte activará la pantalla completa nativa
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

  // Filtrar órdenes válidas para el KDS de cocina:
  // 1. Excluir órdenes anuladas (status === '3')
  // 2. Solo mostrar órdenes que contengan platos enviados a cocina (isKitchenItem !== false)
  const validOrders = (activeOrders || [])
    .filter((o) => o.status !== '3')
    .filter((o) => {
      const kitchenItems = (o.items || []).filter((it) => it.isKitchenItem !== false);
      return kitchenItems.length > 0;
    });

  // 1. En preparación: pendientes ordenados de más viejos a más nuevos (FIFO cocina)
  const prepOrders = validOrders
    .filter((o) => getOrderKdsStatus(o) === 'PREPARING')
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return tA - tB;
    });

  // 2. Listas: SOLO órdenes de las últimas 10 horas (<= 600 min), ordenadas de MÁS NUEVAS a MÁS VIEJAS
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

  // Paginación adaptativa según tamaño de tarjeta, resolución y auto-ajuste
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
    kdsAutoFit ? 'autofit-active' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`view-section active kds-theme-${kdsTheme}`}
      data-kds-theme={kdsTheme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        ...pixelShiftStyle
      }}
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
          <div
            style={{
              textAlign: 'center',
              padding: '90px 20px',
              color: '#64748b',
              fontSize: '1.25rem',
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '2.5rem' }}>👨‍🍳</span>
            <span>{kdsFilter === 'READY' ? t('kds_empty_ready') : t('kds_empty_prep')}</span>
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
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
