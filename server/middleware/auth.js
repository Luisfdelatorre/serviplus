/**
 * Autenticación y autorización para Serviplus POS.
 *
 * - Tokens JWT firmados con `AUTH_SECRET` (desde .env).
 * - Roles: 'admin' (SecurityLevel <= 2) y 'cashier' (resto de empleados).
 * - Rate-limit en memoria por IP para intentos de PIN (`/api/auth/login`, `/api/admin/auth`).
 * - Modo de compatibilidad LAN (`STRICT_AUTH=true` para exigir token en rutas operativas;
 *   en rutas críticas de admin/config siempre se valida cuando el cliente envía token o cuando STRICT_AUTH=true).
 */
const jwt = require('jsonwebtoken');
const { getAuthSecret } = require('../config');

const loginAttempts = new Map();
const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ATTEMPTS = 12;

function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

function pinRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now - entry.firstAttemptAt < WINDOW_MS) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.firstAttemptAt)) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: `Demasiados intentos de PIN. Intenta nuevamente en ${retryAfterSec} segundos.`
      });
    }
  } else if (entry) {
    loginAttempts.delete(ip);
  }

  req.recordFailedPinAttempt = () => {
    const cur = loginAttempts.get(ip);
    if (!cur || Date.now() - cur.firstAttemptAt >= WINDOW_MS) {
      loginAttempts.set(ip, { count: 1, firstAttemptAt: Date.now() });
    } else {
      cur.count += 1;
    }
  };

  req.clearPinAttempts = () => {
    loginAttempts.delete(ip);
  };

  next();
}

function signSessionToken(employee, expiresIn = '12h') {
  const role = employee.role || (Number(employee.securityLevel) <= 2 ? 'admin' : 'cashier');
  return jwt.sign(
    {
      sub: String(employee.id),
      employeeId: employee.id,
      name: employee.name,
      role,
      securityLevel: employee.securityLevel || (role === 'admin' ? 1 : 5)
    },
    getAuthSecret(),
    { expiresIn }
  );
}

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
    return authHeader.trim();
  }
  if (req.headers['x-pos-token']) return String(req.headers['x-pos-token']).trim();
  return null;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getAuthSecret());
  } catch (_) {
    return null;
  }
}

/**
 * Adjunta `req.user` si hay un JWT válido en la petición. Nunca bloquea.
 */
function attachUser(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
  next();
}

/**
 * Middleware de autorización por rol.
 * - Si el cliente envía un token inválido/expirado o con rol insuficiente -> 401/403.
 * - Si no envía token y `STRICT_AUTH=true` -> 401.
 */
function requireRole(...allowedRoles) {
  const strict = process.env.STRICT_AUTH === 'true';
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      if (strict) {
        return res.status(401).json({ success: false, error: 'Autenticación requerida' });
      }
      return next();
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      if (strict) {
        return res.status(401).json({ success: false, error: 'Sesión inválida o expirada' });
      }
      return next();
    }

    req.user = decoded;
    if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role) && decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes para realizar esta acción'
      });
    }
    next();
  };
}

/** Cabeceras básicas de seguridad HTTP para el servidor de tienda. */
function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

module.exports = {
  pinRateLimiter,
  signSessionToken,
  extractToken,
  verifyToken,
  attachUser,
  requireRole,
  securityHeaders
};

