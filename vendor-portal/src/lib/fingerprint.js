/**
 * Fingerprint ponderado de la máquina (ver docs/deployment-licensing.md §3).
 *
 * La app envía `fingerprint` como objeto con 4 componentes, cada uno ya hasheado en el cliente:
 *   { boardUuid, machineGuid, diskSerial, cpuId }
 * Coincide si al menos 3 de 4 componentes son iguales.
 * Por compatibilidad también se acepta un string (debe coincidir exacto).
 */
import { canonicalJson, sha256Hex } from './crypto';

export const FINGERPRINT_COMPONENTS = ['boardUuid', 'machineGuid', 'diskSerial', 'cpuId'];
export const MIN_MATCHES = 3;

export function normalizeFingerprint(input) {
  if (typeof input === 'string') {
    const value = input.trim();
    if (!value || value.length > 512) return null;
    return { raw: value };
  }
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of FINGERPRINT_COMPONENTS) {
    const v = input[key];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (s.length > 256) return null;
    out[key] = s;
  }
  // Se exigen al menos 3 componentes para poder aplicar la regla 3 de 4.
  return Object.keys(out).length >= MIN_MATCHES ? out : null;
}

export function fingerprintHash(fp) {
  return sha256Hex(canonicalJson(fp));
}

export function countMatches(a, b) {
  if (!a || !b) return 0;
  if (a.raw || b.raw) return a.raw && a.raw === b.raw ? FINGERPRINT_COMPONENTS.length : 0;
  return FINGERPRINT_COMPONENTS.filter((k) => a[k] && b[k] && a[k] === b[k]).length;
}

export function fingerprintMatches(a, b) {
  return countMatches(a, b) >= MIN_MATCHES;
}

/** Vista segura para el panel: solo prefijos de cada componente. */
export function fingerprintPreview(fp) {
  if (!fp) return [];
  if (fp.raw) return [{ name: 'raw', value: `${String(fp.raw).slice(0, 10)}…` }];
  return FINGERPRINT_COMPONENTS.map((k) => ({ name: k, value: fp[k] ? `${fp[k].slice(0, 10)}…` : '—' }));
}
