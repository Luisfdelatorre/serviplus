/**
 * Catálogo centralizado de denominaciones de efectivo según la moneda (Currency)
 * Soporta conteo físico de gavetas de dinero para cualquier país/moneda.
 */

export const CURRENCY_DENOMINATIONS = {
  COP: [
    { id: '100k', label: '$100.000', type: 'Billete', unitValue: 100000, color: '#10b981' },
    { id: '50k',  label: '$50.000',  type: 'Billete', unitValue: 50000,  color: '#a855f7' },
    { id: '20k',  label: '$20.000',  type: 'Billete', unitValue: 20000,  color: '#f59e0b' },
    { id: '10k',  label: '$10.000',  type: 'Billete', unitValue: 10000,  color: '#f43f5e' },
    { id: '5k',   label: '$5.000',   type: 'Billete', unitValue: 5000,   color: '#0891b2' },
    { id: '2k',   label: '$2.000',   type: 'Billete', unitValue: 2000,   color: '#2563eb' },
    { id: '1k',   label: '$1.000',   type: 'Billete / Moneda', unitValue: 1000, color: '#b45309' },
    { id: 'coins',label: 'Monedas',  type: '$500, $200, $100, $50', unitValue: 1000, color: '#94a3b8' }
  ],
  USD: [
    { id: '100u', label: '$100', type: 'Billete', unitValue: 100, color: '#10b981' },
    { id: '50u',  label: '$50',  type: 'Billete', unitValue: 50,  color: '#a855f7' },
    { id: '20u',  label: '$20',  type: 'Billete', unitValue: 20,  color: '#f59e0b' },
    { id: '10u',  label: '$10',  type: 'Billete', unitValue: 10,  color: '#f43f5e' },
    { id: '5u',   label: '$5',   type: 'Billete', unitValue: 5,   color: '#0891b2' },
    { id: '2u',   label: '$2',   type: 'Billete', unitValue: 2,   color: '#2563eb' },
    { id: '1u',   label: '$1',   type: 'Billete', unitValue: 1,   color: '#b45309' },
    { id: 'coins_u', label: 'Monedas', type: 'Cents ($0.50, $0.25, $0.10)', unitValue: 1, color: '#94a3b8' }
  ],
  EUR: [
    { id: '100e', label: '100€', type: 'Billete', unitValue: 100, color: '#10b981' },
    { id: '50e',  label: '50€',  type: 'Billete', unitValue: 50,  color: '#a855f7' },
    { id: '20e',  label: '20€',  type: 'Billete', unitValue: 20,  color: '#f59e0b' },
    { id: '10e',  label: '10€',  type: 'Billete', unitValue: 10,  color: '#f43f5e' },
    { id: '5e',   label: '5€',   type: 'Billete', unitValue: 5,   color: '#0891b2' },
    { id: '2e',   label: '2€',   type: 'Moneda',  unitValue: 2,   color: '#2563eb' },
    { id: '1e',   label: '1€',   type: 'Moneda',  unitValue: 1,   color: '#b45309' },
    { id: 'coins_e', label: 'Centavos', type: 'Cent (0.50, 0.20, 0.10)', unitValue: 1, color: '#94a3b8' }
  ],
  MXN: [
    { id: '1000m', label: '$1.000', type: 'Billete', unitValue: 1000, color: '#10b981' },
    { id: '500m',  label: '$500',   type: 'Billete', unitValue: 500,  color: '#a855f7' },
    { id: '200m',  label: '$200',   type: 'Billete', unitValue: 200,  color: '#f59e0b' },
    { id: '100m',  label: '$100',   type: 'Billete', unitValue: 100,  color: '#f43f5e' },
    { id: '50m',   label: '$50',    type: 'Billete', unitValue: 50,   color: '#0891b2' },
    { id: '20m',   label: '$20',    type: 'Billete', unitValue: 20,   color: '#2563eb' },
    { id: '10m',   label: '$10',    type: 'Moneda',  unitValue: 10,   color: '#b45309' },
    { id: 'coins_m', label: 'Monedas', type: '$5, $2, $1, $0.50', unitValue: 1, color: '#94a3b8' }
  ]
};

/**
 * Obtiene las denominaciones inicializadas en 0 para la moneda especificada.
 * Si la moneda no existe en el catálogo, usa COP como fallback.
 * @param {string} currencyCode Código ISO de la moneda (ej. 'COP', 'USD', 'EUR')
 * @returns {Array} Lista de denominaciones con qty: 0
 */
export function getDenominationsForCurrency(currencyCode = 'COP') {
  const code = (currencyCode || 'COP').toUpperCase();
  const catalog = CURRENCY_DENOMINATIONS[code] || CURRENCY_DENOMINATIONS.COP;
  return catalog.map((item) => ({
    ...item,
    qty: 0
  }));
}

