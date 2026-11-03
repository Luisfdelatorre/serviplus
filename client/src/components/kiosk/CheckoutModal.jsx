import React from 'react';
import { CheckoutView } from './checkout/CheckoutView';

/**
 * CheckoutModal (Re-export como Vista Inmersiva)
 * Mantiene compatibilidad hacia atrás delegando en la nueva arquitectura modular inmersiva.
 */
export function CheckoutModal(props) {
  return <CheckoutView {...props} />;
}

export default CheckoutModal;
