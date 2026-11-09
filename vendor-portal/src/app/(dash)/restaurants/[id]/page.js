import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { requirePageOperator } from '@/lib/pageAuth';
import { DeleteRestaurantButton, RestaurantFormButton } from '@/components/RestaurantForm';
import { IssueLicenseButton } from '@/components/LicenseForm';
import { ChannelBadge, ExpiryText, FeatureList, LicenseStatusBadge } from '@/components/badges';

export default async function RestaurantDetailPage({ params }) {
  await requirePageOperator();
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { licenses: { include: { seats: { where: { status: 'ACTIVE' } } }, orderBy: { issuedAt: 'desc' } } }
  });
  if (!restaurant) notFound();

  return (
    <>
      <div className="dash-breadcrumb"><Link href="/restaurants">Restaurantes</Link> / {restaurant.name}</div>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">{restaurant.name}</h1>
          <p className="dash-page-subtitle">NIT <span className="dash-mono">{restaurant.nit}</span></p>
        </div>
        <div className="dash-actions">
          <RestaurantFormButton restaurant={restaurant} />
          <DeleteRestaurantButton restaurant={restaurant} />
          <IssueLicenseButton restaurantId={restaurant.id} />
        </div>
      </div>

      <div className="dash-grid is-2">
        <div className="dash-card">
          <div className="dash-card-header"><h2 className="dash-card-title">Datos del cliente</h2></div>
          <div className="dash-card-body">
            <dl className="dash-dl">
              <dt>Razón social</dt><dd>{restaurant.legalName || '—'}</dd>
              <dt>NIT</dt><dd className="dash-mono">{restaurant.nit}</dd>
              <dt>Dirección</dt><dd>{[restaurant.address, restaurant.city].filter(Boolean).join(', ') || '—'}</dd>
              <dt>Alta</dt><dd>{fmtDate(restaurant.createdAt)}</dd>
            </dl>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><h2 className="dash-card-title">Contacto</h2></div>
          <div className="dash-card-body">
            <dl className="dash-dl">
              <dt>Nombre</dt><dd>{restaurant.contactName || '—'}</dd>
              <dt>Teléfono</dt><dd>{restaurant.contactPhone || '—'}</dd>
              <dt>Email</dt><dd>{restaurant.contactEmail || '—'}</dd>
              <dt>Notas</dt><dd>{restaurant.notes || '—'}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header"><h2 className="dash-card-title">Licencias</h2></div>
        <div className="dash-card-body is-flush dash-table-wrap">
          {restaurant.licenses.length === 0 ? (
            <div className="dash-empty">Sin licencias. Usa “Emitir licencia”.</div>
          ) : (
            <table className="dash-table">
              <thead><tr><th>Clave</th><th>Estado</th><th>Canal</th><th>Features</th><th>Vence</th><th>Equipos</th><th>Emitida</th></tr></thead>
              <tbody>
                {restaurant.licenses.map((l) => (
                  <tr key={l.id} className={l.status === 'REVOKED' ? 'is-muted' : ''}>
                    <td><Link className="dash-mono" href={`/licenses/${l.id}`}>SVP-…-{l.keyLast4}</Link></td>
                    <td><LicenseStatusBadge license={l} /></td>
                    <td><ChannelBadge channel={l.channel} /></td>
                    <td><FeatureList features={l.features} /></td>
                    <td><ExpiryText expiresAt={l.expiresAt} /></td>
                    <td>{l.seats.length} / {l.maxSeats}</td>
                    <td className="dash-small">{fmtDateTime(l.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
