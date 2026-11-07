import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMenu, fetchActiveOrders, fetchPublicConfig } from '../api';
import { useMenuStore } from '../store/useMenuStore';
import { useKdsStore } from '../store/useKdsStore';
import { updateKioskConfig } from '../config/kioskConfig';

/**
 * Hook para inicialización y sincronización de datos de Aldelo POS
 * Reemplaza el useEffect inline de carga inicial en App.jsx.
 */
export function useBootstrap() {
  const setCategories = useMenuStore((state) => state.setCategories);
  const setActiveOrders = useKdsStore((state) => state.setActiveOrders);

  const menuQuery = useQuery({
    queryKey: ['menu'],
    queryFn: () => fetchMenu().catch(() => []),
  });

  const ordersQuery = useQuery({
    queryKey: ['orders', 'active'],
    queryFn: () => fetchActiveOrders().catch(() => []),
  });

  const configQuery = useQuery({
    queryKey: ['public-config'],
    queryFn: () => fetchPublicConfig().catch(() => null),
  });

  useEffect(() => {
    if (menuQuery.data && menuQuery.data.length > 0) {
      setCategories(menuQuery.data);
    }
  }, [menuQuery.data, setCategories]);

  useEffect(() => {
    if (ordersQuery.data && ordersQuery.data.length > 0) {
      setActiveOrders(ordersQuery.data);
    }
  }, [ordersQuery.data, setActiveOrders]);

  useEffect(() => {
    if (configQuery.data) {
      updateKioskConfig(configQuery.data);
    }
  }, [configQuery.data]);

  return {
    isLoading: menuQuery.isLoading || ordersQuery.isLoading || configQuery.isLoading,
    menu: menuQuery.data,
    orders: ordersQuery.data,
    config: configQuery.data
  };
}

export default useBootstrap;

