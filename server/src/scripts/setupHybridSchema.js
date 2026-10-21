import dotenv from "dotenv";
dotenv.config();
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Weighted full-text search expression. MUST match keywordSearch.js exactly.
const EXPR = `(
  setweight(to_tsvector('english', coalesce(name,'')),'A') ||
  setweight(to_tsvector('english', coalesce(eligibility,'')),'B') ||
  setweight(to_tsvector('english', coalesce(description,'') || ' ' || coalesce(benefits,'')),'C')
)`;

// Idempotent DDL for the hybrid retrieval + eligibility caching architecture.
// Safe to re-run at deploy or boot. `prisma db push` cannot represent the
// expression GIN index, so this guarantees it survives schema pushes.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "SchemeEligibility" (
      "id" TEXT NOT NULL,
      "schemeId" TEXT NOT NULL,
      "sourceHash" TEXT NOT NULL,
      "extractedRules" JSONB,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "modelVersion" TEXT NOT NULL DEFAULT 'unknown',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SchemeEligibility_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SchemeEligibility_schemeId_key" ON "SchemeEligibility"("schemeId")`,
  `CREATE INDEX IF NOT EXISTS "SchemeEligibility_status_idx" ON "SchemeEligibility"("status")`,
  `CREATE INDEX IF NOT EXISTS "SchemeEligibility_sourceHash_idx" ON "SchemeEligibility"("sourceHash")`,
];

async function main() {
  const client = await pool.connect();
  try {
    for (const sql of STATEMENTS) {
      await client.query(sql);
    }
    console.log("✓ SchemeEligibility table ensured");

    const t0 = Date.now();
    // CONCURRENTLY avoids locking writes on the live table; cannot run in a txn.
    await client.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Scheme_search_gin_idx" ON "Scheme" USING GIN (${EXPR})`
    );
    console.log(`✓ FTS GIN index ensured (${Date.now() - t0}ms)`);

    const plan = await client.query(
      `EXPLAIN SELECT id FROM "Scheme" WHERE "isActive"=true AND ${EXPR} @@ websearch_to_tsquery('english','widow pension')`
    );
    const usesIndex = plan.rows.some((r) => /Scheme_search_gin_idx/.test(Object.values(r)[0]));
    console.log(usesIndex ? "✓ planner uses GIN index" : "⚠ planner NOT using GIN index");
  } catch (e) {
    console.log("SETUP_ERROR: " + e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
