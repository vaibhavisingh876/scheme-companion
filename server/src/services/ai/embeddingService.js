import prisma from "../../config/prisma.js";
import { getExtractor } from "./embeddingModel.js";
import { buildSearchText } from "../ai/recommendation/searchTextBuilder.js";

const BATCH_SIZE = 5;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Regenerates embeddings for ALL active schemes.
 * Call this after you change the buildSearchText logic.
 */
export const regenerateAllEmbeddings = async () => {
  try {
    const schemes = await prisma.scheme.findMany({
      where: { isActive: true },
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
        schemeFor: true,
        searchText: true,
      },
    });

    console.log(`🔍 Regenerating embeddings for ${schemes.length} active schemes...`);

    const extractor = await getExtractor();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < schemes.length; i += BATCH_SIZE) {
      const batch = schemes.slice(i, i + BATCH_SIZE);

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
        `✅ Progress: ${Math.min(i + BATCH_SIZE, schemes.length)}/${schemes.length} | ✓ ${successCount} | ✗ ${failCount}`
      );

      await delay(500);
    }

    console.log(`🎉 Embedding regeneration complete. Success: ${successCount} | Failed: ${failCount}`);
  } catch (error) {
    console.error("❌ Embedding regeneration error:", error.message);
  }
};

/**
 * Updates embeddings only for schemes that have NULL/empty embeddings.
 * Fast path for normal operation.
 */
export const updateMissingEmbeddings = async () => {
  try {
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
        schemeFor: true,
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