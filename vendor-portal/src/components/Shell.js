'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { section: 'General' },
  { href: '/', label: 'Resumen', exact: true },
  { section: 'Clientes' },
  { href: '/restaurants', label: 'Restaurantes' },
  { href: '/licenses', label: 'Licencias' },
  { href: '/seats', label: 'Puestos', countKey: 'flagged' },
  { href: '/escrow', label: 'Custodia de claves' },
  { section: 'Producto' },
  { href: '/releases', label: 'Versiones' },
  { href: '/audit', label: 'Auditoría' }
];

export function Shell({ operator, counts, showSimulator, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = showSimulator ? [...NAV, { section: 'Desarrollo' }, { href: '/simulator', label: 'Simulador de app' }] : NAV;

  async function logout() {
    await fetch('/api/vendor/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-brand-name">ServiPlus</span>
          <span className="dash-brand-tag">Portal del proveedor</span>
        </div>
        <nav className="dash-nav" aria-label="Principal">
          {items.map((item) => {
            if (item.section) return <div key={item.section} className="dash-nav-section">{item.section}</div>;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const count = item.countKey ? counts?.[item.countKey] : 0;
            return (
              <Link key={item.href} href={item.href} className={`dash-nav-link ${active ? 'is-active' : ''}`}>
                <span>{item.label}</span>
                {count > 0 && <span className="dash-nav-count" title="Fingerprints duplicados">{count}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <span className="dash-topbar-env">{showSimulator ? 'Entorno de desarrollo' : 'Producción'}</span>
          <div className="dash-topbar-user">
            <div>
              <div className="dash-topbar-name">{operator.name}</div>
              <div className="dash-topbar-email">{operator.email}</div>
            </div>
            <button type="button" className="dash-btn is-small" onClick={logout}>Salir</button>
          </div>
        </header>
        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}
