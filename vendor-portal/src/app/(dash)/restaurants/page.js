import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/format';
import { requirePageOperator } from '@/lib/pageAuth';
import { RestaurantFormButton } from '@/components/RestaurantForm';

export default async function RestaurantsPage({ searchParams }) {
  await requirePageOperator();
  const { q = '', new: openNew } = await searchParams;
  const term = String(q).trim();
  const restaurants = await prisma.restaurant.findMany({
    where: term ? { OR: [
      { name: { contains: term, mode: 'insensitive' } },
      { nit: { contains: term } },
      { city: { contains: term, mode: 'insensitive' } }
    ] } : undefined,
    include: { licenses: { select: { status: true, seats: { where: { status: 'ACTIVE' }, select: { id: true } } } } },
    orderBy: { name: 'asc' }
  });

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Restaurantes</h1>
          <p className="dash-page-subtitle">Clientes con ServiPlus instalado o por instalar.</p>
        </div>
        <div className="dash-actions">
          <form className="dash-actions" action="/restaurants">
            <input className="dash-input" name="q" placeholder="Buscar por nombre, NIT o ciudad" defaultValue={term} />
          </form>
          <RestaurantFormButton primary defaultOpen={openNew === '1'} />
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-card-body is-flush dash-table-wrap">
          {restaurants.length === 0 ? (
            <div className="dash-empty">{term ? 'Sin resultados.' : 'Aún no hay restaurantes. Crea el primero.'}</div>
          ) : (
            <table className="dash-table">
              <thead><tr><th>Nombre</th><th>NIT</th><th>Ciudad</th><th>Contacto</th><th>Licencias</th><th>Equipos</th><th>Alta</th></tr></thead>
              <tbody>
                {restaurants.map((r) => {
                  const active = r.licenses.filter((l) => l.status === 'ACTIVE').length;
                  const seats = r.licenses.reduce((n, l) => n + l.seats.length, 0);
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/restaurants/${r.id}`}>{r.name}</Link></td>
                      <td className="dash-mono">{r.nit}</td>
                      <td>{r.city || '—'}</td>
                      <td>{r.contactName || '—'}<div className="dash-small dash-muted">{r.contactPhone || r.contactEmail || ''}</div></td>
                      <td>{active} / {r.licenses.length}</td>
                      <td>{seats}</td>
                      <td className="dash-small">{fmtDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
