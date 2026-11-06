import React, { useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useMenuStore } from './store/useMenuStore';
import { useKdsStore } from './store/useKdsStore';
import { fetchMenu, fetchActiveOrders, fetchPublicConfig } from './api';
import { updateKioskConfig } from './config/kioskConfig';
import { resolveRouteFromWindow } from './shared/navigation/routeResolver';
import { Header } from './components/common/Header';
import { AppRouter } from './app/AppRouter';
import { UnifiedLoginModal } from './components/auth/UnifiedLoginModal';
import { CashShiftModal } from './components/cashier/CashShiftModal';
import { AdminSettingsModal } from './components/admin/AdminSettingsModal';
import './app/layouts/TerminalLayouts.css';
import './components/admin/AdminModals.css';

export function App() {
  // Conexión y sincronización Socket.IO
  useSocket();

  const activeTab = useMenuStore((state) => state.activeTab);
  const isFullscreen = useMenuStore((state) => state.isFullscreen);
  const setFullscreen = useMenuStore((state) => state.setFullscreen);
  const setCategories = useMenuStore((state) => state.setCategories);
  const setActiveOrders = useKdsStore((state) => state.setActiveOrders);
  const setActiveTab = useMenuStore((state) => state.setActiveTab);

  // Estados de modales (Terminal Login, Entrada/Salida Caja, Admin)
  const isLoginModalOpen = useMenuStore((state) => state.isLoginModalOpen);
  const closeLoginModal = useMenuStore((state) => state.closeLoginModal);
  const isCashShiftModalOpen = useMenuStore((state) => state.isCashShiftModalOpen);
  const closeCashShiftModal = useMenuStore((state) => state.closeCashShiftModal);
  const isAdminLoginOpen = useMenuStore((state) => state.isAdminLoginOpen);
  const isAdminSettingsOpen = useMenuStore((state) => state.isAdminSettingsOpen);
  const currentAdmin = useMenuStore((state) => state.currentAdmin);
  const closeAdminLogin = useMenuStore((state) => state.closeAdminLogin);
  const openAdminSettings = useMenuStore((state) => state.openAdminSettings);
  const closeAdminSettings = useMenuStore((state) => state.closeAdminSettings);

  // Sincronizar salida de pantalla completa nativa (Esc, etc.)
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isFs && isFullscreen) {
        setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isFullscreen, setFullscreen]);

  // Sincronizar cambios de URL (hash o popstate) mediante routeResolver centralizado
  useEffect(() => {
    const handleUrlChange = () => {
      const resolved = resolveRouteFromWindow();
      setActiveTab(resolved.tab);
      if (resolved.fullscreen) {
        setFullscreen(true);
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [setActiveTab, setFullscreen]);

  // Cargar datos iniciales desde el backend de Aldelo POS
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [menuData, ordersData, publicConfig] = await Promise.all([
          fetchMenu().catch(() => []),
          fetchActiveOrders().catch(() => []),
          fetchPublicConfig().catch(() => null)
        ]);
        if (menuData && menuData.length > 0) {
          setCategories(menuData);
        }
        if (ordersData && ordersData.length > 0) {
          setActiveOrders(ordersData);
        }
        if (publicConfig) {
          updateKioskConfig(publicConfig);
        }
      } catch (err) {
        console.error('Error cargando datos iniciales:', err);
      }
    }

    loadInitialData();
  }, [setCategories, setActiveOrders]);

  const showHeader = !isFullscreen && activeTab !== 'home' && activeTab !== 'cash-in' && activeTab !== 'admin';

  return (
    <div className="app-shell-root">
      {showHeader && <Header />}
      <main className="app-shell-main">
        <AppRouter activeTab={activeTab} />
      </main>

      {/* Modal Reutilizable de Identificación y Acceso de Terminal POS */}
      <UnifiedLoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        mode="terminal"
      />

      {/* Modal de Entrada y Salida de Cajero (Apertura y Cierre Z) */}
      <CashShiftModal
        isOpen={isCashShiftModalOpen}
        onClose={closeCashShiftModal}
      />

      {/* Modal Reutilizable de Acceso Administrativo Aldelo */}
      <UnifiedLoginModal
        isOpen={isAdminLoginOpen}
        onClose={closeAdminLogin}
        mode="admin"
        onSuccess={(employee, token) => openAdminSettings(employee, token)}
      />

      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        onClose={closeAdminSettings}
        currentAdmin={currentAdmin}
      />
    </div>
  );
}

export default App;
