// Compares two eval snapshots: reports per-query overlap of top-K scheme ids,
// newly surfaced schemes, and dropped schemes relative to the baseline.
//
// Usage: node eval/compare.js <baseline.json> <candidate.json> [topK]
import fs from "fs";

const [baselinePath, candidatePath, topKArg] = process.argv.slice(2);
const TOP_K = Number(topKArg || 20);

const load = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const baseline = load(baselinePath);
const candidate = load(candidatePath);

const byId = (snap) => Object.fromEntries(snap.results.map((r) => [r.id, r]));
const b = byId(baseline);
const c = byId(candidate);

let totalOverlap = 0;
let totalQueries = 0;

console.log(`\nComparing "${baseline.label}" -> "${candidate.label}" (top ${TOP_K})\n`);
console.log("qid   base cand overlap  newly-surfaced / dropped");
console.log("----- ---- ---- -------  --------------------------------");

for (const id of Object.keys(b)) {
  const br = b[id];
  const cr = c[id] || { schemes: [] };
  if (br.error) {
    console.log(`${id}   BASELINE ERROR: ${br.error}`);
    continue;
  }
  const bIds = (br.schemes || []).slice(0, TOP_K).map((s) => s.id);
  const cIds = (cr.schemes || []).slice(0, TOP_K).map((s) => s.id);
  const bSet = new Set(bIds);
  const cSet = new Set(cIds);
  const overlap = bIds.filter((x) => cSet.has(x)).length;
  const surfaced = cr.schemes.filter((s) => !bSet.has(s.id)).slice(0, 3).map((s) => s.name);
  const dropped = br.schemes.filter((s) => !cSet.has(s.id)).slice(0, 3).map((s) => s.name);
  totalOverlap += overlap;
  totalQueries += 1;
  const denom = Math.max(bIds.length, 1);
  console.log(
    `${id}  ${String(bIds.length).padStart(4)} ${String(cIds.length).padStart(4)} ${String(overlap).padStart(4)}/${denom}   +[${surfaced.map((n) => n.slice(0, 22)).join(", ")}] -[${dropped.map((n) => n.slice(0, 22)).join(", ")}]`
  );
}

const avg = totalQueries ? (totalOverlap / totalQueries).toFixed(1) : "0";
console.log(`\nMean top-${TOP_K} id overlap with baseline: ${avg} schemes/query`);
console.log("(Low overlap is expected when retrieval improves; verify surfaced results are relevant, not that overlap is high.)\n");
