import React, { useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useMenuStore } from './store/useMenuStore';
import { useKdsStore } from './store/useKdsStore';
import { fetchMenu, fetchActiveOrders, fetchPublicConfig } from './api';
import { updateKioskConfig } from './config/kioskConfig';
import { Header } from './components/common/Header';
import { KdsGrid } from './components/kds/KdsGrid';
import { KioskView } from './components/kiosk/KioskView';
import { CashierView } from './components/cashier/CashierView';
import { TurnsBoard } from './components/turns/TurnsBoard';
import { HomeHubView } from './components/home/HomeHubView';
import { UnifiedLoginModal } from './components/auth/UnifiedLoginModal';
import { CashShiftModal } from './components/cashier/CashShiftModal';
import { CashDrawerOpeningView } from './components/cashier/CashDrawerOpeningView';
import { AdminSettingsModal } from './components/admin/AdminSettingsModal';
import { AdminSettingsView } from './components/admin/AdminSettingsView';
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

  // Sincronizar cambios de URL (hash o popstate)
  useEffect(() => {
    const handleUrlChange = () => {
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const pathname = window.location.pathname.toLowerCase();

      if (tabParam && ['home', 'kiosk', 'cashier', 'kds', 'turns', 'pos', 'cash-in', 'apertura', 'admin', 'settings', 'config'].includes(tabParam.toLowerCase())) {
        if (tabParam.toLowerCase() === 'pos') setActiveTab('cashier');
        else if (tabParam.toLowerCase() === 'apertura') setActiveTab('cash-in');
        else if (tabParam.toLowerCase() === 'settings' || tabParam.toLowerCase() === 'config') setActiveTab('admin');
        else setActiveTab(tabParam.toLowerCase());
      } else if (hash.includes('cash-in') || hash.includes('apertura')) {
        setActiveTab('cash-in');
      } else if (hash.includes('admin') || hash.includes('settings') || hash.includes('config') || hash.includes('manage')) {
        setActiveTab('admin');
      } else if (hash.includes('home')) {
        setActiveTab('home');
      } else if (hash.includes('kds') || pathname.includes('kds')) {
        setActiveTab('kds');
      } else if (hash.includes('cashier') || hash.includes('caja') || hash.includes('pos')) {
        setActiveTab('cashier');
      } else if (hash.includes('turn') || hash.includes('pickup')) {
        setActiveTab('turns');
      } else if (hash.includes('kiosk') || hash.includes('autoservice') || hash.includes('customers')) {
        setActiveTab('kiosk');
      }

      if (
        pathname.includes('kds') ||
        hash.includes('kds') ||
        (tabParam && tabParam.toLowerCase() === 'kds') ||
        params.get('fullscreen') === 'true' ||
        params.get('fs') === '1' ||
        hash.includes('fullscreen') ||
        hash.includes('autoservice') ||
        hash === '#/kiosk' ||
        hash === '#kiosk' ||
        pathname === '/kiosk' ||
        pathname === '/kiosk/' ||
        pathname.endsWith('/kiosk') ||
        pathname.endsWith('/kiosk/') ||
        pathname.includes('autoservice')
      ) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {!isFullscreen && activeTab !== 'home' && activeTab !== 'cash-in' && activeTab !== 'admin' && <Header />}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'home' && <HomeHubView />}
        {activeTab === 'cash-in' && <CashDrawerOpeningView />}
        {activeTab === 'kds' && <KdsGrid />}
        {activeTab === 'kiosk' && <KioskView />}
        {activeTab === 'cashier' && <CashierView />}
        {activeTab === 'turns' && <TurnsBoard />}
        {activeTab === 'admin' && <AdminSettingsView />}
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
        onSuccess={(employee) => openAdminSettings(employee)}
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
