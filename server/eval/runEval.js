// Runs the recommendation pipeline over EVAL_QUERIES and writes a compact
// result snapshot (ids, names, relevanceScore, eligibility status if present)
// for regression comparison.
//
// Usage: node eval/runEval.js <outFile.json> [label]
import fs from "fs";
import path from "path";
import { EVAL_QUERIES } from "./queries.js";
import { recommendSchemes } from "../src/services/ai/recommendation/recommendationService.js";

const outFile = process.argv[2];
if (!outFile) {
  console.error("usage: node eval/runEval.js <outFile.json> [label]");
  process.exit(1);
}
const label = process.argv[3] || path.basename(outFile);

const results = [];
for (const { id, label: qLabel, q } of EVAL_QUERIES) {
  const t0 = Date.now();
  try {
    const res = await recommendSchemes(q);
    const schemes = (res.schemes || []).map((s, rank) => ({
      rank,
      id: s.id,
      name: s.name,
      relevanceScore: s.relevanceScore,
      eligibilityStatus: s.eligibilityStatus ?? null,
    }));
    results.push({
      id,
      label: qLabel,
      query: q,
      ms: Date.now() - t0,
      count: schemes.length,
      meta: res.meta || null,
      profile: res.profile || null,
      schemes,
    });
    console.log(`✓ ${id} ${qLabel}: ${schemes.length} schemes (${Date.now() - t0}ms)`);
  } catch (err) {
    results.push({ id, label: qLabel, query: q, error: err.message, schemes: [] });
    console.log(`✗ ${id} ${qLabel}: ERROR ${err.message}`);
  }
}

const outPath = path.resolve(outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ label, generatedAt: new Date().toISOString(), results }, null, 2));
console.log(`\nWrote ${outPath}`);
process.exit(0);
