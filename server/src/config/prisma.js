import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

// Supabase's session pooler has a small fixed pool. Keep each app process
// from opening Prisma's much larger CPU-based default connection pool.
const databaseUrl = process.env.DATABASE_URL;
const pooledDatabaseUrl = databaseUrl
  ? (() => {
      const url = new URL(databaseUrl);
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "5");
      }
      return url.toString();
    })()
  : undefined;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(pooledDatabaseUrl ? { datasources: { db: { url: pooledDatabaseUrl } } } : {}),
    log: ["error", "warn"],
  });



export default prisma;
