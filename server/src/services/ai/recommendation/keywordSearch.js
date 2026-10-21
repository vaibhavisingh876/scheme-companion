import prisma from "../../../config/prisma.js";

// This expression MUST stay byte-for-byte identical to the one indexed by
// Scheme_search_gin_idx (see src/scripts/setupHybridSchema.js), otherwise the planner
// falls back to a ~3s sequential scan. Weights: name (A) > eligibility (B) >
// description+benefits (C), per the design's field-weighting guidance.
const SEARCH_VECTOR_EXPR = `(
  setweight(to_tsvector('english', coalesce(name,'')),'A') ||
  setweight(to_tsvector('english', coalesce(eligibility,'')),'B') ||
  setweight(to_tsvector('english', coalesce(description,'') || ' ' || coalesce(benefits,'')),'C')
)`;

// websearch_to_tsquery treats commas/spaces as AND, which over-constrains long
// natural-language queries and hurts recall. Turning the comma-separated
// official phrases from searchQuery into explicit OR clauses keeps each phrase
// internally ANDed while letting any phrase match — high recall, and
// ts_rank_cd still orders by match quality.
const buildWebsearchQuery = (text) => {
  const cleaned = String(text || "")
    .replace(/["'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const orJoined = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" OR ");
  return orJoined.slice(0, 1000);
};

/**
 * PostgreSQL full-text keyword search over name + eligibility + description.
 * Returns a ranked list of { id, score } (best first). Never throws: an empty
 * array signals "keyword stage unavailable", letting the caller fall back to
 * vector-only retrieval without breaking the request.
 */
export const keywordSearch = async (queryText, limit = 100) => {
  const tsqueryInput = buildWebsearchQuery(queryText);
  if (!tsqueryInput) return [];

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, ts_rank_cd(${SEARCH_VECTOR_EXPR}, websearch_to_tsquery('english', $1)) AS score
         FROM "Scheme"
        WHERE "isActive" = true
          AND ${SEARCH_VECTOR_EXPR} @@ websearch_to_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2::int`,
      tsqueryInput,
      limit
    );
    return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
  } catch (err) {
    console.warn("[keywordSearch] FTS failed, degrading to vector-only:", err.message);
    return [];
  }
};
