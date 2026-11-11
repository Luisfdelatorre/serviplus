import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicConfig } from '../api';
import { getEnabledPaymentMethods } from '../shared/paymentMethods';

const REFRESH_MS = 60 * 1000;

/**
 * Métodos de pago habilitados por el administrador. Comparte la consulta `public-config`
 * con el arranque de la app y se refresca sola para reflejar cambios hechos desde Admin.
 */
export function usePaymentMethods() {
  const { data } = useQuery({
    queryKey: ['public-config'],
    queryFn: () => fetchPublicConfig().catch(() => null),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true
  });
  const methodFlags = data && data.wompi && data.wompi.methods;
  return useMemo(() => getEnabledPaymentMethods(methodFlags), [methodFlags]);
}

export default usePaymentMethods;
