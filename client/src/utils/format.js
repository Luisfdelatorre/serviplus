// Formateadores de moneda y tiempo para Colombia y KDS
export function formatCOP(aldeloVal) {
  const num = parseFloat(aldeloVal) || 0;
  const cop = Math.round(num * 1000);
  return '$' + cop.toLocaleString('es-CO');
}

/**
 * Formateador genérico de moneda según código ISO (COP, USD, EUR, MXN, etc.)
 * @param {number|string} amount Monto a formatear
 * @param {string} currency Código de moneda (ej. 'COP', 'USD')
 * @returns {string} Monto formateado con su símbolo respectivo
 */
export function formatCurrency(amount, currency = 'COP') {
  const num = parseFloat(amount) || 0;
  const curr = (currency || 'COP').toUpperCase();
  const localeMap = {
    COP: 'es-CO',
    USD: 'en-US',
    EUR: 'es-ES',
    MXN: 'es-MX',
    PEN: 'es-PE'
  };
  const locale = localeMap[curr] || 'es-CO';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'COP' ? 0 : 2,
      minimumFractionDigits: 0
    }).format(num);
  } catch (_) {
    return '$' + Math.round(num).toLocaleString(locale);
  }
}

export function formatRegularTime(dateObj) {
  if (!dateObj) return '';
  const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

export function getElapsedMinutes(dateStr) {
  if (!dateStr) return 0;
  const created = new Date(dateStr);
  const now = new Date();
  const diffMs = now - created;
  return Math.max(0, Math.floor(diffMs / 60000));
}
