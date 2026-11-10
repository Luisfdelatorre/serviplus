import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { fmtDateTime, grantState } from '@/lib/format';
import { requirePageOperator } from '@/lib/pageAuth';
import { AuditTable } from '@/components/AuditTable';
import { ChannelBadge, ExpiryText, FeatureList, LicenseStatusBadge } from '@/components/badges';
import { EditLicenseButton } from '@/components/LicenseForm';
import { EscrowActions, LicenseStatusActions } from '@/components/LicenseActions';
import { SeatsTable } from '@/components/SeatsTable';
import { EscrowSummary } from '@/components/EscrowSummary';

export default async function LicenseDetailPage({ params }) {
  await requirePageOperator();
  const { id } = await params;
  const license = await prisma.license.findUnique({
    where: { id },
    include: {
      restaurant: true,
      seats: { orderBy: { activatedAt: 'desc' } },
      escrow: { select: { storedAt: true, wrappedSha: true, createdAt: true } },
      escrowGrants: { include: { operator: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }
    }
  });
  if (!license) notFound();
  const audit = await prisma.auditLog.findMany({
    where: { entity: 'license', entityId: id }, orderBy: { at: 'desc' }, take: 30
  });
  const activeSeats = license.seats.filter((s) => s.status === 'ACTIVE');
  const flagged = activeSeats.some((s) => s.duplicateFlag);
  const now = new Date();
  const openGrant = license.escrowGrants.find((g) => grantState(g, now).open);
  const editable = { id: license.id, features: license.features, channel: license.channel,
    expiresAt: license.expiresAt?.toISOString() ?? null, maxSeats: license.maxSeats, notes: license.notes };

  return (
    <>
      <div className="dash-breadcrumb">
        <Link href="/restaurants">Restaurantes</Link> / <Link href={`/restaurants/${license.restaurantId}`}>{license.restaurant.name}</Link> / Licencia
      </div>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title dash-mono">SVP-…-{license.keyLast4}</h1>
          <p className="dash-page-subtitle">{license.restaurant.name} · NIT {license.restaurant.nit}</p>
        </div>
        <div className="dash-actions">
          <EditLicenseButton license={editable} />
          <LicenseStatusActions license={{ id: license.id, status: license.status }} />
        </div>
      </div>

      {flagged && (
        <div className="dash-error">
          Se detectó una copia: este puesto reportó desde otro fingerprint y la copia más nueva fue revocada.
          Revisa el caso con el restaurante.
        </div>
      )}
      {license.status === 'REVOKED' && (
        <div className="dash-notice">
          Revocada el {fmtDateTime(license.revokedAt)}. Motivo: {license.revokeReason || '—'}
        </div>
      )}

      <div className="dash-grid is-2">
        <div className="dash-card">
          <div className="dash-card-header"><h2 className="dash-card-title">Licencia</h2><LicenseStatusBadge license={license} /></div>
          <div className="dash-card-body">
            <dl className="dash-dl">
              <dt>licenseId</dt><dd className="dash-mono">{license.id}</dd>
              <dt>restaurantId</dt><dd className="dash-mono">{license.restaurantId}</dd>
              <dt>Canal</dt><dd><ChannelBadge channel={license.channel} /></dd>
              <dt>Features</dt><dd><FeatureList features={license.features} /></dd>
              <dt>Vence</dt><dd><ExpiryText expiresAt={license.expiresAt} /></dd>
              <dt>Equipos</dt><dd>{activeSeats.length} activos de {license.maxSeats}</dd>
              <dt>Emitida</dt><dd>{fmtDateTime(license.issuedAt)}</dd>
              <dt>Notas</dt><dd>{license.notes || '—'}</dd>
            </dl>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Custodia de clave de datos</h2>
            <EscrowActions licenseId={license.id} canAuthorize={Boolean(license.escrow?.storedAt)}
              openGrant={openGrant ? { id: openGrant.id } : null} />
          </div>
          <div className="dash-card-body">
            <EscrowSummary escrow={license.escrow} grants={license.escrowGrants} now={now} />
          </div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Equipos (puestos)</h2>
          <span className="dash-small dash-muted">Para mover a un PC nuevo: liberar puesto → activar en el PC nuevo.</span>
        </div>
        <div className="dash-card-body is-flush"><SeatsTable seats={license.seats} /></div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header"><h2 className="dash-card-title">Historial</h2></div>
        <div className="dash-card-body is-flush"><AuditTable entries={audit} /></div>
      </div>
    </>
  );
}
