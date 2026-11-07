import { useQuery } from '@tanstack/react-query';
import { useMenuStore } from '../store/useMenuStore';
import { fetchCurrentCashShift } from '../api';

/**
 * Adaptador centralizado de sesión y estado operativo.
 * Único punto del sistema que conoce dónde residen:
 * - Sesión del cajero: useMenuStore.sessionEmployee
 * - Sesión del administrador: useMenuStore.currentAdmin
 * - Estado de turno de caja (Apertura / Cierre): /api/cashier/shift/current
 */
export function useSession() {
  const cashier = useMenuStore((state) => state.sessionEmployee);
  const admin = useMenuStore((state) => state.currentAdmin);

  const { data: shiftData, isLoading: isShiftLoading, refetch: refetchShift } = useQuery({
    queryKey: ['cash-shift', 'current'],
    queryFn: () => fetchCurrentCashShift().catch(() => ({ isOpen: false, shift: null })),
    staleTime: 10_000,
  });

  const shiftOpen = Boolean(shiftData?.isOpen && shiftData?.shift);

  return {
    cashier,
    admin,
    shiftOpen,
    isShiftLoading,
    currentShift: shiftData?.shift || null,
    refetchShift
  };
}

export default useSession;

