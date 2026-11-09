import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import {
  KioskLayout,
  PosLayout,
  KdsLayout,
  DisplayLayout,
  AdminLayout,
  TerminalShell,
  TerminalLoader
} from './layouts/TerminalLayouts';
import { RequireAuth, RequireAdmin, RequireShift } from './guards/guards';

// Helper lazyNamed para imports lazy limpios
const lazyNamed = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

// Helper routeLayout para envolver layouts con Suspense y Outlet
const routeLayout = (Layout) => (
  <Layout>
    <Suspense fallback={<TerminalLoader />}>
      <Outlet />
    </Suspense>
  </Layout>
);

const HomeHubView = lazyNamed(() => import('../components/home/HomeHubView'), 'HomeHubView');
const KioskView = lazyNamed(() => import('../components/kiosk/KioskView'), 'KioskView');
const CashierView = lazyNamed(() => import('../components/cashier/CashierView'), 'CashierView');
const CashDrawerOpeningView = lazyNamed(() => import('../components/cashier/CashDrawerOpeningView'), 'CashDrawerOpeningView');
const KdsGrid = lazyNamed(() => import('../components/kds/KdsGrid'), 'KdsGrid');
const TurnsBoard = lazyNamed(() => import('../components/turns/TurnsBoard'), 'TurnsBoard');
const AdminSettingsView = lazyNamed(() => import('../components/admin/AdminSettingsView'), 'AdminSettingsView');
const ActivationView = lazyNamed(() => import('../components/license/ActivationView'), 'ActivationView');
const SetupWizard = lazyNamed(() => import('../components/setup/SetupWizard'), 'SetupWizard');

export function AppRouter() {
  return (
    <Routes>
      {/* Ruta 1: Home Hub (Abierta) */}
      <Route
        path="/"
        element={
          <TerminalShell terminal="home">
            <Suspense fallback={<TerminalLoader />}>
              <HomeHubView />
            </Suspense>
          </TerminalShell>
        }
      />

      {/* Activación de licencia (abierta: primer paso tras instalar) */}
      <Route
        path="/activate"
        element={
          <Suspense fallback={<TerminalLoader />}>
            <ActivationView />
          </Suspense>
        }
      />

      {/* Asistente de configuración (abierto: primera ejecución) */}
      <Route
        path="/setup"
        element={
          <Suspense fallback={<TerminalLoader />}>
            <SetupWizard />
          </Suspense>
        }
      />

      {/* Rutas Abiertas de Terminales */}
      <Route element={routeLayout(KioskLayout)}>
        <Route path="/kiosk" element={<KioskView />} />
      </Route>

      <Route element={routeLayout(KdsLayout)}>
        <Route path="/kds/:station?" element={<KdsGrid />} />
      </Route>

      <Route element={routeLayout(DisplayLayout)}>
        <Route path="/display" element={<TurnsBoard />} />
      </Route>

      {/* Rutas Protegidas de Front / Caja */}
      <Route element={<RequireAuth />}>
        <Route element={routeLayout(PosLayout)}>
          <Route path="/front/cash-in" element={<CashDrawerOpeningView />} />
          <Route element={<RequireShift />}>
            <Route path="/front" element={<CashierView />} />
          </Route>
        </Route>
      </Route>

      {/* Ruta Protegida de Administración */}
      <Route element={<RequireAdmin />}>
        <Route element={routeLayout(AdminLayout)}>
          <Route path="/admin" element={<AdminSettingsView />} />
        </Route>
      </Route>

      {/* Redirecciones de compatibilidad */}
      <Route path="/pos" element={<Navigate to="/front" replace />} />
      <Route path="/cashier" element={<Navigate to="/front" replace />} />
      <Route path="/cash-in" element={<Navigate to="/front/cash-in" replace />} />
      <Route path="/apertura" element={<Navigate to="/front/cash-in" replace />} />
      <Route path="/turns" element={<Navigate to="/display" replace />} />
      <Route path="/react/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
