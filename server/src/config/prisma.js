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
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "10");
      }
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "20");
      }
      if (!url.searchParams.has("max_idle_connection_lifetime")) {
        url.searchParams.set("max_idle_connection_lifetime", "60");
      }
      if (!url.searchParams.has("sslmode") && url.hostname.includes("supabase")) {
        url.searchParams.set("sslmode", "require");
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
