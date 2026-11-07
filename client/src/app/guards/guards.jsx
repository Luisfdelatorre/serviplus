import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useMenuStore } from '../../store/useMenuStore';
import { UnifiedLoginModal } from '../../components/auth/UnifiedLoginModal';
import { TerminalLoader } from '../layouts/TerminalLayouts';

/**
 * Guardia de Autenticación de Terminal POS
 * Requiere que un cajero / empleado haya iniciado sesión.
 * Si no está autenticado, presenta el modal de login de terminal.
 */
export function RequireAuth() {
  const { cashier } = useSession();
  const navigate = useNavigate();

  if (cashier) return <Outlet />;

  return (
    <UnifiedLoginModal
      isOpen
      mode="terminal"
      onClose={() => navigate('/', { replace: true })}
    />
  );
}

/**
 * Guardia de Acceso Administrativo
 * Requiere credenciales con rol administrativo (seguridad nivel <= 2).
 * Si no está autenticado, presenta el modal de login de administrador.
 */
export function RequireAdmin() {
  const { admin } = useSession();
  const openAdminSettings = useMenuStore((s) => s.openAdminSettings);
  const navigate = useNavigate();

  if (admin) return <Outlet />;

  return (
    <UnifiedLoginModal
      isOpen
      mode="admin"
      onClose={() => navigate('/', { replace: true })}
      onSuccess={(employee, token) => openAdminSettings(employee, token)}
    />
  );
}

/**
 * Guardia de Turno de Caja Abierto
 * Verifica que exista un arqueo/turno de caja activo.
 * Si la caja está cerrada, redirige automáticamente a /front/cash-in para apertura inicial.
 */
export function RequireShift() {
  const { shiftOpen, isShiftLoading } = useSession();

  if (isShiftLoading) {
    return <TerminalLoader label="Verificando turno de caja..." />;
  }

  return shiftOpen ? <Outlet /> : <Navigate to="/front/cash-in" replace />;
}
