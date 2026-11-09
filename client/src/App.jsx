import { useBootstrap } from './hooks/useBootstrap';
import { useLegacyRouteRedirect } from './hooks/useLegacyRouteRedirect';
import { useFullscreenSync } from './hooks/useFullscreenSync';
import { AppRouter } from './app/AppRouter';
import { AlertDialogHost } from './components/common/AlertDialog';
import { LicenseWatcher } from './components/license/LicenseWatcher';
import './app/layouts/TerminalLayouts.css';
import './components/admin/AdminModals.css';

export function App() {
  useLegacyRouteRedirect();
  useFullscreenSync();
  useBootstrap();

  return (
    <>
      <LicenseWatcher />
      <AppRouter />
      <AlertDialogHost />
    </>
  );
}

export default App;
