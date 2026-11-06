import React from 'react';
import { UnifiedLoginModal } from './UnifiedLoginModal';

/**
 * Acceso a Terminal POS (Cajeros y Turnos)
 * Envoltorio del componente reutilizable UnifiedLoginModal
 */
export function TerminalLoginModal(props) {
  return <UnifiedLoginModal mode="terminal" {...props} />;
}

export default TerminalLoginModal;
