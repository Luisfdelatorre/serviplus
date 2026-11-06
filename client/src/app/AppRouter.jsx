import React, { Suspense, lazy } from 'react';
import {
  KioskLayout,
  PosLayout,
  KdsLayout,
  DisplayLayout,
  AdminLayout,
  TerminalShell,
  TerminalLoader
} from './layouts/TerminalLayouts';

// Code-splitting por terminal: el Kiosco no descarga el bundle de Admin ni de Caja
const HomeHubView = lazy(() =>
  import('../components/home/HomeHubView').then((m) => ({ default: m.HomeHubView }))
);
const KioskView = lazy(() =>
  import('../components/kiosk/KioskView').then((m) => ({ default: m.KioskView }))
);
const CashierView = lazy(() =>
  import('../components/cashier/CashierView').then((m) => ({ default: m.CashierView }))
);
const CashDrawerOpeningView = lazy(() =>
  import('../components/cashier/CashDrawerOpeningView').then((m) => ({ default: m.CashDrawerOpeningView }))
);
const KdsGrid = lazy(() =>
  import('../components/kds/KdsGrid').then((m) => ({ default: m.KdsGrid }))
);
const TurnsBoard = lazy(() =>
  import('../components/turns/TurnsBoard').then((m) => ({ default: m.TurnsBoard }))
);
const AdminSettingsView = lazy(() =>
  import('../components/admin/AdminSettingsView').then((m) => ({ default: m.AdminSettingsView }))
);

export function AppRouter({ activeTab }) {
  return (
    <Suspense fallback={<TerminalLoader />}>
      {activeTab === 'home' && (
        <TerminalShell terminal="home">
          <HomeHubView />
        </TerminalShell>
      )}
      {activeTab === 'cash-in' && (
        <PosLayout>
          <CashDrawerOpeningView />
        </PosLayout>
      )}
      {activeTab === 'kds' && (
        <KdsLayout>
          <KdsGrid />
        </KdsLayout>
      )}
      {activeTab === 'kiosk' && (
        <KioskLayout>
          <KioskView />
        </KioskLayout>
      )}
      {activeTab === 'cashier' && (
        <PosLayout>
          <CashierView />
        </PosLayout>
      )}
      {activeTab === 'turns' && (
        <DisplayLayout>
          <TurnsBoard />
        </DisplayLayout>
      )}
      {activeTab === 'admin' && (
        <AdminLayout>
          <AdminSettingsView />
        </AdminLayout>
      )}
    </Suspense>
  );
}

