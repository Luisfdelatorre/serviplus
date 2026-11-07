/* eslint-disable react/prop-types */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { useSocket } from '../hooks/useSocket';
import '../i18n'; // Inicializa i18n
import './AppProviders.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Hook useSocket() unificado como Provider reactivo
function SocketProvider({ children }) {
  useSocket();
  return children;
}

function Fallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="app-error-fallback">
      <h2 className="app-error-title">Algo salió mal</h2>
      <pre className="app-error-pre">{error?.message || 'Error inesperado al cargar la aplicación.'}</pre>
      <button type="button" className="app-error-btn" onClick={resetErrorBoundary}>
        Reintentar
      </button>
    </div>
  );
}

export function AppProviders({ children }) {
  return (
    <ErrorBoundary FallbackComponent={Fallback} onReset={() => window.location.reload()}>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          {/* <AuthProvider> y demás providers van aquí cuando se expandan */}
          {children}
        </SocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default AppProviders;

