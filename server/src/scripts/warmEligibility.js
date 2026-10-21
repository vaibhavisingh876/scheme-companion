// Offline eligibility cache warmer.
// Populates SchemeEligibility by extracting rules for schemes that are missing
// or stale, paced to stay within the Groq token budget. Run it ahead of traffic
// (or periodically) so request-time verification has cached rules to use.
//
// Usage: node src/scripts/warmEligibility.js [maxSchemes]
import dotenv from "dotenv";
dotenv.config();
import prisma from "../config/prisma.js";
import { extractAndStore, sourceHashOf } from "../services/ai/recommendation/eligibilityService.js";

const MAX_SCHEMES = Number(process.argv[2] || Infinity);
const PAGE = 500;
const CHUNK = 40; // extractAndStore hard-caps at 40 per invocation

const normalizeText = (t) => String(t || "").replace(/\s+/g, " ").trim();

async function main() {
  let skip = 0;
  let considered = 0;
  let queued = 0;
  const totals = { extracted: 0, failed: 0, llmCalls: 0, tokens: 0 };

  for (;;) {
    const rows = await prisma.scheme.findMany({
      where: { isActive: true },
      select: { id: true, eligibility: true },
      orderBy: { id: "asc" },
      skip,
      take: PAGE,
    });
    if (!rows.length) break;
    skip += rows.length;

    const withText = rows.filter((r) => normalizeText(r.eligibility));
    const ids = withText.map((r) => r.id);
    const existing = await prisma.schemeEligibility.findMany({ where: { schemeId: { in: ids } } });
    const byId = new Map(existing.map((e) => [e.schemeId, e]));

    const missing = [];
    for (const r of withText) {
      considered++;
      const hash = sourceHashOf(r.eligibility);
      const row = byId.get(r.id);
      if (row) {
        const hashMatches = row.sourceHash === hash;
        if (row.status === "success" && hashMatches) continue;
        if (row.status === "failed" && hashMatches && row.attempts >= 2) continue;
      }
      missing.push({ schemeId: r.id, text: normalizeText(r.eligibility), hash });
      if (considered >= MAX_SCHEMES) break;
    }

    for (let i = 0; i < missing.length; i += CHUNK) {
      const batch = missing.slice(i, i + CHUNK);
      queued += batch.length;
      const stats = await extractAndStore(batch);
      totals.extracted += stats.extracted;
      totals.failed += stats.failed;
      totals.llmCalls += stats.llmCalls;
      totals.tokens += stats.tokens;
      console.log(
        `[warm] processed=${queued} extracted=${totals.extracted} failed=${totals.failed} llm=${totals.llmCalls} tokens=${totals.tokens}`
      );
    }

    if (considered >= MAX_SCHEMES) break;
  }

  console.log("\nDONE", JSON.stringify(totals));
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("WARM_ERROR", e);
  await prisma.$disconnect();
  process.exit(1);
});
