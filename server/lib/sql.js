/**
 * Helpers de saneamiento para SQL de Access/Jet.
 *
 * node-adodb no soporta parámetros enlazados, así que TODA entrada externa que se
 * interpole en una sentencia debe pasar por estas funciones:
 *  - sqlInt / sqlNum: fuerzan tipo numérico finito (nunca texto).
 *  - sqlStr: escapa comillas simples y elimina caracteres de control; devuelve el literal con comillas.
 *  - sqlBool: True/False de Jet.
 *  - sqlEnum: valida contra una lista blanca.
 */

function sqlInt(value, { min = -2147483648, max = 2147483647, fallback = null } = {}) {
  const n = typeof value === 'number' ? Math.trunc(value) : parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) {
    if (fallback === null) throw new Error(`Valor entero inválido: ${String(value).slice(0, 30)}`);
    return fallback;
  }
  return n;
}

function sqlNum(value, { min = -1e12, max = 1e12, fallback = 0, decimals = 4 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return Number(n.toFixed(decimals));
}

function sqlStr(value, maxLen = 255) {
  const s = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, maxLen)
    .replace(/'/g, "''");
  return `'${s}'`;
}

function sqlBool(value) {
  return value ? 'True' : 'False';
}

function sqlEnum(value, allowed, fallback) {
  const s = String(value ?? '');
  if (allowed.includes(s)) return s;
  if (fallback !== undefined) return fallback;
  throw new Error(`Valor no permitido: ${s.slice(0, 30)}`);
}

module.exports = { sqlInt, sqlNum, sqlStr, sqlBool, sqlEnum };

