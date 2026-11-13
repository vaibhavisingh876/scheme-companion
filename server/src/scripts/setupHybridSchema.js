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

// Prisma migrations own all tables, including GroqEligibilityRules. This script
// only adds the expression GIN index, which Prisma cannot represent in schema.
async function main() {
  const client = await pool.connect();
  try {
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
