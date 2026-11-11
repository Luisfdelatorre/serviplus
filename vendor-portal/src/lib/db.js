import { PrismaClient } from '@prisma/client';

// Reutiliza el cliente entre recargas de `next dev`.
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__svpPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__svpPrisma = prisma;
