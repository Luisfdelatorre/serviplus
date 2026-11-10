import { prisma } from './db';

/**
 * Registra una acción. `actor` es el email del operador o "app" para llamadas de instalaciones.
 * Nunca guardar material de claves en `details`.
 */
export async function audit({ operator, actor, action, entity, entityId, details, ip }, tx = prisma) {
  await tx.auditLog.create({
    data: {
      operatorId: operator?.id || null,
      actor: actor || operator?.email || 'system',
      action,
      entity,
      entityId: entityId || null,
      details: details || undefined,
      ip: ip || null
    }
  });
}
