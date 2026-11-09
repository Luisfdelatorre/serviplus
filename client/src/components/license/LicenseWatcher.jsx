import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLicenseStatus } from '../../api/license';
import { socket } from '../../socket';
import { LICENSE_QUERY_KEY, isLocked } from './licenseStatus';
import './LicenseWatcher.css';

/**
 * Vigila la licencia en todas las pantallas:
 * - Sin licencia → lleva a `/activate`.
 * - Gracia / bloqueo → muestra una franja de aviso (nunca interrumpe la operación).
 */
export function LicenseWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: LICENSE_QUERY_KEY,
    queryFn: fetchLicenseStatus,
    refetchInterval: 5 * 60 * 1000,
    retry: 1
  });

  useEffect(() => {
    const onStatus = (next) => queryClient.setQueryData(LICENSE_QUERY_KEY, next);
    socket.on('license:status', onStatus);
    return () => socket.off('license:status', onStatus);
  }, [queryClient]);

  useEffect(() => {
    if (isLocked(status) && location.pathname !== '/activate') {
      navigate('/activate', { replace: true });
    }
  }, [status, location.pathname, navigate]);

  if (!status || location.pathname === '/activate') return null;
  if (status.status !== 'grace' && status.status !== 'blocked') return null;

  const until = status.graceEndsAt ? new Date(status.graceEndsAt).toLocaleString() : null;
  return (
    <div className={`lic-banner ${status.status === 'blocked' ? 'lic-banner--blocked' : 'lic-banner--grace'}`} role="status">
      <span className="lic-banner-text">{status.message}</span>
      {status.status === 'grace' && until && <span className="lic-banner-meta">Hasta: {until}</span>}
      {status.supportContact && <span className="lic-banner-meta">Soporte: {status.supportContact}</span>}
    </div>
  );
}

export default LicenseWatcher;
