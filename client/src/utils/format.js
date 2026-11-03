// Formateadores de moneda y tiempo para Colombia y KDS
export function formatCOP(aldeloVal) {
  const num = parseFloat(aldeloVal) || 0;
  const cop = Math.round(num * 1000);
  return '$' + cop.toLocaleString('es-CO');
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
