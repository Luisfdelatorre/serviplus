import { useBootstrap } from './hooks/useBootstrap';
import { useLegacyRouteRedirect } from './hooks/useLegacyRouteRedirect';
import { useFullscreenSync } from './hooks/useFullscreenSync';
import { AppRouter } from './app/AppRouter';
import { AlertDialogHost } from './components/common/AlertDialog';
import './app/layouts/TerminalLayouts.css';
import './components/admin/AdminModals.css';

export function App() {
  useLegacyRouteRedirect();
  useFullscreenSync();
  useBootstrap();

  return (
    <>
      <AppRouter />
      <AlertDialogHost />
    </>
  );
}

export default App;
