// Offline eligibility rules warmer.
// Persists GroqEligibilityRules for schemes that are missing or stale, paced to
// stay within the Groq token budget. Run it ahead of traffic (or periodically)
// so request-time verification has persisted rules to reuse.
//
// Usage: node src/scripts/warmEligibility.js [maxSchemes]
import dotenv from "dotenv";
dotenv.config();
import prisma from "../config/prisma.js";
import {
  getStoredEligibilityRules,
  extractAndStore,
} from "../services/ai/recommendation/eligibilityService.js";

const MAX_SCHEMES = Number(process.argv[2] || Infinity);
const PAGE = 500;
const CHUNK = 60; // getStoredEligibilityRules / extractAndStore hard-cap at 60

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

    for (let i = 0; i < rows.length && considered < MAX_SCHEMES; i += CHUNK) {
      const group = rows.slice(i, i + CHUNK);
      // Reuses the same staleness/cooldown rules as the request path.
      const { missing } = await getStoredEligibilityRules(group);
      considered += group.length;

      const batch = missing.filter((entry) => entry.text);
      if (!batch.length) continue;

      queued += batch.length;
      const { stats } = await extractAndStore(batch);
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
