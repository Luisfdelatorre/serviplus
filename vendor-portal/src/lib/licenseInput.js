import { HttpError, str } from './http';
import { normalizeChannel, normalizeFeatures } from './licensing';

/** Campos editables de una licencia (emisión y PATCH). */
export function parseLicenseInput(body, { partial = false } = {}) {
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const out = {};
  if (!partial || has('features')) out.features = normalizeFeatures(body.features);
  if (!partial || has('channel')) out.channel = normalizeChannel(body.channel);
  if (!partial || has('expiresAt')) {
    if (body.expiresAt == null || body.expiresAt === '') {
      out.expiresAt = null; // perpetua
    } else {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) throw new HttpError(400, 'validation', 'expiresAt inválida');
      out.expiresAt = d;
    }
  }
  if (!partial || has('maxSeats')) {
    const n = body.maxSeats == null || body.maxSeats === '' ? 1 : Number(body.maxSeats);
    if (!Number.isInteger(n) || n < 1 || n > 50) throw new HttpError(400, 'validation', 'maxSeats debe estar entre 1 y 50');
    out.maxSeats = n;
  }
  if (!partial || has('notes')) out.notes = str(body.notes, { max: 2000, field: 'Notas' });
  return out;
}
