import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new HttpError(400, 'invalid_json', 'El cuerpo debe ser un objeto JSON');
  }
}

export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd && fwd.split(',')[0].trim()) || request.headers.get('x-real-ip') || null;
}

/** Envuelve un handler y convierte errores en respuestas JSON {error, message}. */
export function handler(fn) {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.code, message: err.message, ...(err.extra || {}) }, err.status);
      }
      if (err?.code === 'P2002') {
        return json({ error: 'conflict', message: 'Ya existe un registro con ese valor único' }, 409);
      }
      if (err?.code === 'P2025') {
        return json({ error: 'not_found', message: 'Registro no encontrado' }, 404);
      }
      console.error('[vendor-portal]', err);
      return json({ error: 'internal_error', message: 'Error interno' }, 500);
    }
  };
}

/** Rate-limit simple en memoria (por proceso). Suficiente para una sola instancia. */
const buckets = new Map();
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) {
    const retry = Math.ceil((windowMs - (now - entry.start)) / 1000);
    throw new HttpError(429, 'rate_limited', `Demasiadas solicitudes. Reintenta en ${retry} s`);
  }
}

// Validación mínima de entrada.
export function str(value, { max = 200, required = false, field = 'campo' } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'validation', `${field} es obligatorio`);
    return null;
  }
  const s = String(value).trim();
  if (required && !s) throw new HttpError(400, 'validation', `${field} es obligatorio`);
  if (s.length > max) throw new HttpError(400, 'validation', `${field} supera ${max} caracteres`);
  return s || null;
}
