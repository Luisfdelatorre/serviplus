import { fmtDateTime, grantState } from '@/lib/format';

/**
 * Estado del escrow sin exponer material de claves: solo si existe, cuándo se guardó
 * y un prefijo del hash de la clave envuelta (para comparar con el equipo durante soporte).
 */
export function EscrowSummary({ escrow, grants, now }) {
  return (
    <div className="dash-form">
      <dl className="dash-dl">
        <dt>Estado</dt>
        <dd>{escrow?.storedAt
          ? <span className="dash-badge is-ok">Clave custodiada</span>
          : <span className="dash-badge">Pendiente (la app la sube tras activar)</span>}</dd>
        <dt>Guardada</dt><dd>{fmtDateTime(escrow?.storedAt)}</dd>
        <dt>Huella (SHA-256)</dt><dd className="dash-mono">{escrow?.wrappedSha ? `${escrow.wrappedSha.slice(0, 12)}…` : '—'}</dd>
      </dl>
      {grants.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Autorización</th><th>Por</th><th>Motivo</th><th>Vence / usada</th></tr></thead>
            <tbody>
              {grants.map((g) => {
                const st = grantState(g, now);
                return (
                  <tr key={g.id}>
                    <td><span className={`dash-badge ${st.cls}`}>{st.label}</span></td>
                    <td className="dash-small">{g.operator.name}</td>
                    <td className="dash-small">{g.reason}</td>
                    <td className="dash-small">{g.usedAt ? fmtDateTime(g.usedAt) : fmtDateTime(g.expiresAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="dash-small dash-muted">El panel nunca muestra la clave de datos ni la clave de envoltura.</p>
    </div>
  );
}
