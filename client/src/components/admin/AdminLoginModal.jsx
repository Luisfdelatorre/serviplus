import React from 'react';
import { UnifiedLoginModal } from '../auth/UnifiedLoginModal';

/**
 * Acceso Administrativo (Gerencia y Configuración)
 * Envoltorio del componente reutilizable UnifiedLoginModal
 */
export function AdminLoginModal(props) {
  return <UnifiedLoginModal mode="admin" {...props} />;
}

export default AdminLoginModal;
