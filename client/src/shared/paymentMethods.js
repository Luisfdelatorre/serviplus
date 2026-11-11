/**
 * Métodos de pago activos, según lo que el administrador habilita en Configuración
 * (`wompi.methods` en la configuración pública).
 *
 * Cada método de la interfaz (id de pago) se controla con una clave de esa configuración.
 * Una clave ausente cuenta como activa, igual que en las pantallas de administración.
 */
export const PAYMENT_METHOD_CONFIG_KEYS = {
  CASH: 'cash',
  CARD: 'wompiLink',
  WOMPI_QR: 'bancolombiaQr'
};

/** Orden en que se ofrecen los métodos al cajero. */
const PAYMENT_METHOD_ORDER = ['CASH', 'CARD', 'WOMPI_QR'];

/** Si el administrador desactiva todos los métodos, se deja el efectivo para no bloquear las ventas. */
const FALLBACK_METHOD = 'CASH';

/** Ids de pago habilitados, en el orden del cajero. */
export function getEnabledPaymentMethods(methodFlags) {
  const flags = methodFlags || {};
  const enabled = PAYMENT_METHOD_ORDER.filter((id) => flags[PAYMENT_METHOD_CONFIG_KEYS[id]] !== false);
  return enabled.length > 0 ? enabled : [FALLBACK_METHOD];
}

/** Método a preseleccionar: el preferido si está habilitado; si no, el primero de `candidates` habilitado. */
export function resolvePaymentMethod(enabledMethods, preferred, candidates = PAYMENT_METHOD_ORDER) {
  if (enabledMethods.includes(preferred)) return preferred;
  return candidates.find((id) => enabledMethods.includes(id)) || enabledMethods[0];
}
