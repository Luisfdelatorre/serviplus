import { Shell } from '@/components/Shell';
import { prisma } from '@/lib/db';
import { isDevTools, requirePageOperator } from '@/lib/pageAuth';

export const dynamic = 'force-dynamic';

export default async function DashLayout({ children }) {
  const operator = await requirePageOperator();
  const flagged = await prisma.seat.count({ where: { duplicateFlag: true, status: 'ACTIVE' } });
  return (
    <Shell operator={operator} counts={{ flagged }} showSimulator={isDevTools}>
      {children}
    </Shell>
  );
}
