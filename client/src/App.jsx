import { useBootstrap } from './hooks/useBootstrap';
import { useLegacyRouteRedirect } from './hooks/useLegacyRouteRedirect';
import { useFullscreenSync } from './hooks/useFullscreenSync';
import { AppRouter } from './app/AppRouter';
import './app/layouts/TerminalLayouts.css';
import './components/admin/AdminModals.css';

export function App() {
  useLegacyRouteRedirect();
  useFullscreenSync();
  useBootstrap();

  return <AppRouter />;
}

export default App;
