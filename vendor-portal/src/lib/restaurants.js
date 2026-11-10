import { HttpError, str } from './http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida los campos editables de un restaurante. `partial` permite PATCH. */
export function parseRestaurantInput(body, { partial = false } = {}) {
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const out = {};
  if (!partial || has('name')) out.name = str(body.name, { required: true, field: 'Nombre', max: 120 });
  if (!partial || has('nit')) {
    const nit = str(body.nit, { required: true, field: 'NIT', max: 20 });
    if (!/^[0-9]{5,15}(-[0-9])?$/.test(nit.replace(/[.\s]/g, ''))) {
      throw new HttpError(400, 'validation', 'NIT inválido (ej. 900123456-7)');
    }
    out.nit = nit.replace(/[.\s]/g, '');
  }
  for (const [key, max] of [['legalName', 160], ['contactName', 120], ['contactPhone', 40],
    ['address', 200], ['city', 80], ['notes', 2000]]) {
    if (!partial || has(key)) out[key] = str(body[key], { max, field: key });
  }
  if (!partial || has('contactEmail')) {
    const email = str(body.contactEmail, { max: 200, field: 'Email' });
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'validation', 'Email de contacto inválido');
    out.contactEmail = email ? email.toLowerCase() : null;
  }
  return out;
}
