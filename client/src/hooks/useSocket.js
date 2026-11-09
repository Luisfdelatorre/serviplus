import { useEffect } from 'react';
import { socket } from '../socket';
import { useKdsStore } from '../store/useKdsStore';
import { useMenuStore } from '../store/useMenuStore';
import { fetchMenu } from '../api';
import { sfx } from '../utils/audio';

export function useSocket() {
  const addOrder = useKdsStore((state) => state.addOrder);
  const updateLocalOrder = useKdsStore((state) => state.updateLocalOrder);
  const setCategories = useMenuStore((state) => state.setCategories);

  useEffect(() => {
    function handleNewOrder(order) {
      console.log('[Socket] Nueva comanda recibida:', order);
      addOrder(order);
    }

    function handleStatusChanged({ orderId, status, tableReady, isPaid }) {
      console.log('[Socket] Estado de orden modificado:', orderId, status);
      updateLocalOrder(orderId, {
        status,
        ...(isPaid !== undefined ? { isPaid } : {}),
        ...(tableReady !== undefined ? { tableReady } : {})
      });
    }

    function handleKdsStatusChanged({ orderId, kdsStatus, itemChecks, tableReady }) {
      console.log('[Socket] Estado KDS modificado:', orderId, kdsStatus);
      if (kdsStatus === 'READY') {
        sfx.playReadyChime();
      }
      updateLocalOrder(orderId, {
        kdsStatus,
        tableReady: tableReady !== undefined ? tableReady : (kdsStatus === 'READY'),
        ...(itemChecks ? { kdsItemChecks: itemChecks } : {})
      });
    }

    function handleMirrorSync(data) {
      if (!data) return;
      const store = useKdsStore.getState();
      if (!store.isMirrorMode) return;

      console.log('[Socket] KDS Mirror Sync recibido:', data);
      if (data.kdsFilter && data.kdsFilter !== store.kdsFilter) {
        store.setKdsFilter(data.kdsFilter, false);
      }
      if (data.kdsPage && data.kdsPage !== store.kdsPage) {
        store.setKdsPage(data.kdsPage, false);
      }
      if (data.kdsTheme && data.kdsTheme !== store.kdsTheme) {
        store.setKdsTheme(data.kdsTheme, false);
      }
    }

    function handleMenuUpdated(payload) {
      console.log('[Socket] Actualización de menú en tiempo real recibida:', payload);
      fetchMenu()
        .then((data) => {
          if (data && data.length > 0) {
            setCategories(data);
            console.log('[Socket] ✅ Catálogo del Kiosco actualizado en vivo con los últimos cambios de Aldelo');
          }
        })
        .catch((err) => console.error('[Socket] Error al refrescar menú:', err));
    }

    socket.on('order:new', handleNewOrder);
    socket.on('order:status_changed', handleStatusChanged);
    socket.on('kds:status_changed', handleKdsStatusChanged);
    socket.on('kds:mirror_sync', handleMirrorSync);
    socket.on('kiosk:menu_updated', handleMenuUpdated);
    socket.on('menu:updated', handleMenuUpdated);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:status_changed', handleStatusChanged);
      socket.off('kds:status_changed', handleKdsStatusChanged);
      socket.off('kds:mirror_sync', handleMirrorSync);
      socket.off('kiosk:menu_updated', handleMenuUpdated);
      socket.off('menu:updated', handleMenuUpdated);
    };
  }, [addOrder, updateLocalOrder, setCategories]);
}
