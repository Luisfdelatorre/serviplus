import { prisma } from '@/lib/db';
import { requirePageOperator } from '@/lib/pageAuth';
import { AuditTable } from '@/components/AuditTable';

export default async function AuditPage() {
  await requirePageOperator();
  const entries = await prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 300 });
  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Auditoría</h1>
          <p className="dash-page-subtitle">Últimas 300 acciones de operadores e instalaciones.</p>
        </div>
      </div>
      <div className="dash-card"><div className="dash-card-body is-flush"><AuditTable entries={entries} /></div></div>
    </>
  );
}
