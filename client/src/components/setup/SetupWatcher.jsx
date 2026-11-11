import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSetupStatus, SETUP_QUERY_KEY } from '../../api/setup';

// Rutas que no deben redirigir a /setup (activación de licencia y el propio asistente).
const EXEMPT = ['/setup', '/activate'];

/** Si la configuración de primera ejecución no está completa, lleva a `/setup`. */
export function SetupWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: status } = useQuery({ queryKey: SETUP_QUERY_KEY, queryFn: fetchSetupStatus, retry: 1 });

  useEffect(() => {
    if (status && !status.completed && !EXEMPT.includes(location.pathname)) {
      navigate('/setup', { replace: true });
    }
  }, [status, location.pathname, navigate]);

  return null;
}

export default SetupWatcher;
