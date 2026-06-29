import prisma from "../../config/prisma.js";
import { getExtractor } from "./embeddingModel.js";
import { buildSearchText } from "./recommendation/searchTextBuilder.js";

const BATCH_SIZE = 5;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const updateMissingEmbeddings = async () => {
  try {
    // FIX: { isEmpty: true } in Prisma only matches [] (literal empty array).
    // Schemes inserted via createMany with no embedding value get NULL in
    // Postgres, which does NOT match isEmpty: true — so the query returns 0
    // rows and the service silently does nothing.
    //
    // Raw SQL catches both NULL and {} (empty array) reliably.
    const rawRows = await prisma.$queryRaw`
      SELECT id FROM "Scheme"
      WHERE "isActive" = true
        AND (embedding IS NULL OR array_length(embedding, 1) IS NULL OR array_length(embedding, 1) = 0)
    `;

    if (rawRows.length === 0) {
      console.log("✅ All embeddings up to date.");
      return;
    }

    const ids = rawRows.map((r) => r.id);
    console.log(`🔍 Schemes needing embeddings: ${ids.length}`);

    // Fetch full data for those IDs
    const schemesToUpdate = await prisma.scheme.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        description: true,
        benefits: true,
        eligibility: true,
        category: true,
        ministry: true,
        tags: true,
        documentsRequired: true,
        allowedOccupations: true,
        allowedCategories: true,
        allowedEducationLevels: true,
        allowedGenders: true,
        allowedStates: true,
        minAge: true,
        maxAge: true,
        minIncome: true,
        maxIncome: true,
        isScholarship: true,
        isFemaleOnly: true,
        searchText: true,
      },
    });

    const extractor = await getExtractor();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < schemesToUpdate.length; i += BATCH_SIZE) {
      const batch = schemesToUpdate.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (scheme) => {
          try {
            const text = buildSearchText(scheme);

            if (!text.trim()) {
              console.warn(`⚠️ Empty search text for scheme ${scheme.id}, skipping.`);
              return;
            }

            const output = await extractor(text, { pooling: "mean", normalize: true });
            await prisma.scheme.update({
              where: { id: scheme.id },
              data: { embedding: Array.from(output.data) },
            });

            successCount++;
          } catch (err) {
            failCount++;
            console.error(`❌ Embedding failed for scheme ${scheme.id}:`, err.message);
          }
        })
      );

      console.log(
        `✅ Progress: ${Math.min(i + BATCH_SIZE, schemesToUpdate.length)}/${schemesToUpdate.length} | ✓ ${successCount} | ✗ ${failCount}`
      );

      await delay(500);
    }

    console.log(`🎉 Embeddings complete. Success: ${successCount} | Failed: ${failCount}`);
  } catch (error) {
    console.error("❌ Embedding Service Error:", error.message);
  }
};