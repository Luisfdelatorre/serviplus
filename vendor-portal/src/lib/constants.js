// Constantes compartidas entre servidor y componentes de cliente (sin dependencias de servidor).

export const FEATURE_CATALOG = [
  { id: 'kiosk', label: 'Kiosco' },
  { id: 'kds', label: 'Pantalla de cocina (KDS)' },
  { id: 'cashier', label: 'Caja' },
  { id: 'aldelo', label: 'Integración Aldelo' },
  { id: 'sqlite', label: 'Modo SQLite' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'sms', label: 'SMS' },
  { id: 'wompi', label: 'Pagos Wompi' },
  { id: 'cloud_sync', label: 'Sincronización nube' }
];

export const DEFAULT_FEATURES = ['kiosk', 'kds', 'cashier'];
export const CHANNELS = ['stable', 'beta'];

// Un heartbeat más viejo que esto se muestra como "sin reporte reciente".
export const HEARTBEAT_STALE_MS = 24 * 60 * 60 * 1000;
