/**
 * Reglas del servidor de licencias. Contrato: docs/deployment-licensing.md §3, §5 y §8.
 *
 * Formato del .lic devuelto por /api/license/activate:
 *   { v: 1, alg: "Ed25519", keyId, payload: { licenseId, restaurantId, fingerprint, issuedAt,
 *     expiresAt, features, channel }, signature }
 * `signature` = Ed25519 sobre canonicalJson(payload) (claves ordenadas, sin espacios).
 */
import { prisma } from './db';
import { audit } from './audit';
import { HttpError } from './http';
import {
  hashLicenseKey, openWithMaster, publicKeyInfo, randomBytes, sealWithMaster, sha256Hex, signPayload
} from './crypto';
import { fingerprintHash, fingerprintMatches, normalizeFingerprint } from './fingerprint';

export const ESCROW_GRANT_TTL_MS = 24 * 60 * 60 * 1000;
const FEATURE_RE = /^[a-z0-9_.-]{1,40}$/;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function normalizeFeatures(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new HttpError(400, 'validation', 'features debe ser una lista');
  const out = [...new Set(input.map((f) => String(f).trim().toLowerCase()).filter(Boolean))];
  for (const f of out) {
    if (!FEATURE_RE.test(f)) throw new HttpError(400, 'validation', `Feature inválida: ${f}`);
  }
  return out.sort();
}

export function normalizeChannel(input) {
  const c = String(input || 'stable');
  if (c !== 'stable' && c !== 'beta') throw new HttpError(400, 'validation', 'channel debe ser stable o beta');
  return c;
}

export function isExpired(license, now = new Date()) {
  return Boolean(license.expiresAt && license.expiresAt <= now);
}

function requireFingerprint(input) {
  const fp = normalizeFingerprint(input);
  if (!fp) {
    throw new HttpError(400, 'invalid_fingerprint',
      'fingerprint debe incluir al menos 3 de: boardUuid, machineGuid, diskSerial, cpuId');
  }
  return fp;
}

function findMatchingSeat(seats, fp, statuses) {
  // El más reciente primero, para que un puesto liberado y vuelto a activar use el registro nuevo.
  return [...seats]
    .sort((a, b) => b.activatedAt - a.activatedAt)
    .find((s) => (!statuses || statuses.includes(s.status)) && fingerprintMatches(s.fingerprint, fp));
}

function buildLic(license, seat) {
  const payload = {
    licenseId: license.id,
    restaurantId: license.restaurantId,
    fingerprint: seat.fingerprint,
    issuedAt: new Date().toISOString(),
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    features: license.features,
    channel: license.channel
  };
  return { v: 1, alg: 'Ed25519', keyId: publicKeyInfo().keyId, payload, signature: signPayload(payload) };
}

async function ensureEscrowKey(tx, licenseId) {
  const existing = await tx.escrowKey.findUnique({ where: { licenseId } });
  if (existing) return existing;
  return tx.escrowKey.create({ data: { licenseId, wrapKeyEnc: sealWithMaster(randomBytes(32)) } });
}

// ---------------------------------------------------------------------------
// API pública para la app instalada
// ---------------------------------------------------------------------------

export async function activate({ licenseKey, fingerprint, appVersion, ip }) {
  if (!licenseKey) throw new HttpError(400, 'validation', 'licenseKey es obligatorio');
  const fp = requireFingerprint(fingerprint);
  const version = appVersion ? String(appVersion).slice(0, 40) : null;

  return prisma.$transaction(async (tx) => {
    const license = await tx.license.findUnique({
      where: { keyHash: hashLicenseKey(licenseKey) },
      include: { seats: true }
    });
    if (!license) throw new HttpError(404, 'invalid_license_key', 'Clave de licencia no válida');
    if (license.status === 'REVOKED') throw new HttpError(403, 'license_revoked', 'La licencia está revocada');
    if (isExpired(license)) throw new HttpError(403, 'license_expired', 'La licencia expiró');

    const revoked = findMatchingSeat(license.seats, fp, ['REVOKED']);
    const active = findMatchingSeat(license.seats, fp, ['ACTIVE']);
    if (revoked && !active) {
      throw new HttpError(403, 'seat_revoked', 'Este equipo fue revocado. Contacta a soporte.');
    }

    let seat = active;
    if (seat) {
      // Reinstalación en el mismo equipo: se reutiliza el puesto.
      seat = await tx.seat.update({
        where: { id: seat.id },
        data: { appVersion: version, lastIp: ip, fingerprint: fp, fingerprintHash: fingerprintHash(fp) }
      });
    } else {
      const activeCount = license.seats.filter((s) => s.status === 'ACTIVE').length;
      if (activeCount >= license.maxSeats) {
        throw new HttpError(409, 'seat_in_use',
          'La licencia ya está activa en otro equipo. Solicita a soporte liberar el puesto.');
      }
      seat = await tx.seat.create({
        data: { licenseId: license.id, fingerprint: fp, fingerprintHash: fingerprintHash(fp), appVersion: version, lastIp: ip }
      });
    }

    const escrow = await ensureEscrowKey(tx, license.id);
    await audit({ actor: 'app', action: active ? 'seat.reactivated' : 'seat.activated', entity: 'license',
      entityId: license.id, details: { seatId: seat.id, appVersion: version }, ip }, tx);

    return {
      lic: buildLic(license, seat),
      seatId: seat.id,
      escrow: {
        alg: 'aes-256-gcm',
        // Clave de envoltura por licencia: la app la usa para envolver su clave de datos y la sube a /escrow.
        wrapKey: openWithMaster(escrow.wrapKeyEnc).toString('base64'),
        stored: Boolean(escrow.wrappedKey)
      }
    };
  });
}

export async function heartbeat({ licenseId, fingerprint, appVersion, ip }) {
  if (!licenseId) throw new HttpError(400, 'validation', 'licenseId es obligatorio');
  const fp = requireFingerprint(fingerprint);
  const version = appVersion ? String(appVersion).slice(0, 40) : null;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const license = await tx.license.findUnique({ where: { id: String(licenseId) }, include: { seats: true } });
    if (!license) throw new HttpError(404, 'unknown_license', 'Licencia desconocida');

    const base = { features: license.features, expiresAt: license.expiresAt?.toISOString() ?? null,
      channel: license.channel, serverTime: now.toISOString() };
    const seat = findMatchingSeat(license.seats, fp);

    if (seat?.status === 'ACTIVE') {
      await tx.seat.update({
        where: { id: seat.id },
        data: { lastHeartbeatAt: now, appVersion: version ?? seat.appVersion, lastIp: ip,
          // Acepta deriva de 1 componente (p. ej. cambio de disco) y actualiza el registro.
          fingerprint: fp, fingerprintHash: fingerprintHash(fp) }
      });
      if (license.status === 'REVOKED') {
        return { status: 'revoked', revoked: true, revokedAt: license.revokedAt?.toISOString() ?? null, ...base };
      }
      if (isExpired(license, now)) return { status: 'expired', revoked: false, ...base };
      return { status: 'active', revoked: false, ...base };
    }

    if (seat) {
      // Puesto liberado o revocado: el equipo debe dejar de operar (la app aplica 72 h de gracia).
      const at = seat.revokedAt || seat.releasedAt;
      return { status: seat.status === 'RELEASED' ? 'released' : 'revoked', revoked: true,
        revokedAt: at?.toISOString() ?? null, ...base };
    }

    // Fingerprint desconocido para esta licencia: la instalación fue copiada a otro equipo.
    const activeSeat = license.seats.find((s) => s.status === 'ACTIVE');
    if (activeSeat) {
      await tx.seat.update({ where: { id: activeSeat.id }, data: { duplicateFlag: true } });
      const dup = await tx.seat.create({
        data: {
          licenseId: license.id, status: 'REVOKED', fingerprint: fp, fingerprintHash: fingerprintHash(fp),
          appVersion: version, lastIp: ip, lastHeartbeatAt: now, revokedAt: now,
          duplicateFlag: true, duplicateOfId: activeSeat.id, statusReason: 'duplicate_fingerprint'
        }
      });
      await audit({ actor: 'app', action: 'seat.duplicate_detected', entity: 'license', entityId: license.id,
        details: { originalSeatId: activeSeat.id, duplicateSeatId: dup.id }, ip }, tx);
    } else {
      await audit({ actor: 'app', action: 'heartbeat.unregistered', entity: 'license', entityId: license.id,
        details: { fingerprintHash: fingerprintHash(fp) }, ip }, tx);
    }
    return { status: 'revoked', revoked: true, revokedAt: now.toISOString(), ...base };
  });
}

async function requireActiveSeat(tx, licenseId, fp) {
  const license = await tx.license.findUnique({ where: { id: String(licenseId) }, include: { seats: true } });
  if (!license) throw new HttpError(404, 'unknown_license', 'Licencia desconocida');
  if (license.status === 'REVOKED') throw new HttpError(403, 'license_revoked', 'La licencia está revocada');
  const seat = findMatchingSeat(license.seats, fp, ['ACTIVE']);
  if (!seat) throw new HttpError(403, 'seat_not_active', 'Este equipo no tiene un puesto activo en la licencia');
  return { license, seat };
}

export async function storeEscrow({ licenseId, fingerprint, wrappedKey, ip }) {
  if (!licenseId) throw new HttpError(400, 'validation', 'licenseId es obligatorio');
  const fp = requireFingerprint(fingerprint);
  const blob = String(wrappedKey || '');
  if (!/^[A-Za-z0-9+/=_-]{16,4096}$/.test(blob)) {
    throw new HttpError(400, 'validation', 'wrappedKey debe ser base64 (16 a 4096 caracteres)');
  }
  return prisma.$transaction(async (tx) => {
    const { license, seat } = await requireActiveSeat(tx, licenseId, fp);
    await ensureEscrowKey(tx, license.id);
    const prev = await tx.escrowKey.findUnique({ where: { licenseId: license.id } });
    const now = new Date();
    await tx.escrowKey.update({
      where: { licenseId: license.id },
      data: { wrappedKey: blob, wrappedSha: sha256Hex(blob), storedAt: now }
    });
    await audit({ actor: 'app', action: prev?.wrappedKey ? 'escrow.rotated' : 'escrow.stored', entity: 'license',
      entityId: license.id, details: { seatId: seat.id }, ip }, tx);
    return { stored: true, storedAt: now.toISOString() };
  });
}

export async function retrieveEscrow({ licenseId, fingerprint, ip }) {
  const fp = requireFingerprint(fingerprint);
  const result = await prisma.$transaction(async (tx) => {
    const { license, seat } = await requireActiveSeat(tx, licenseId, fp);
    const escrow = await tx.escrowKey.findUnique({ where: { licenseId: license.id } });
    if (!escrow?.wrappedKey) throw new HttpError(404, 'escrow_empty', 'No hay clave custodiada para esta licencia');

    const now = new Date();
    // Consumo atómico: solo una recuperación por autorización.
    const consumed = await tx.escrowGrant.updateMany({
      where: { licenseId: license.id, usedAt: null, cancelledAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, usedBySeatId: seat.id }
    });
    // Se devuelve en vez de lanzar para que el registro de auditoría no se pierda en el rollback.
    if (consumed.count === 0) return { denied: true, licenseId: license.id, seatId: seat.id };
    await audit({ actor: 'app', action: 'escrow.retrieved', entity: 'license', entityId: license.id,
      details: { seatId: seat.id }, ip }, tx);
    return {
      alg: 'aes-256-gcm',
      wrapKey: openWithMaster(escrow.wrapKeyEnc).toString('base64'),
      wrappedKey: escrow.wrappedKey,
      storedAt: escrow.storedAt?.toISOString() ?? null
    };
  });

  if (result.denied) {
    await audit({ actor: 'app', action: 'escrow.retrieval_denied', entity: 'license', entityId: result.licenseId,
      details: { seatId: result.seatId }, ip });
    throw new HttpError(403, 'escrow_not_authorized',
      'Recuperación no autorizada. Soporte debe autorizar la restauración desde el panel.');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Versiones
// ---------------------------------------------------------------------------

export function parseSemver(v) {
  const m = SEMVER_RE.exec(String(v || ''));
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
}

export function compareSemver(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] - y[k];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

export function manifestPayload(release) {
  // `channel` va firmado para impedir reutilizar un manifiesto beta en stable.
  return { channel: release.channel, version: release.version, url: release.url, sha256: release.sha256 };
}

export async function latestRelease(channel) {
  const c = normalizeChannel(channel);
  const releases = await prisma.release.findMany({ where: { channel: c, yanked: false } });
  if (!releases.length) return null;
  return releases.sort((a, b) => compareSemver(b.version, a.version))[0];
}
