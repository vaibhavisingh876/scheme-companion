/**
 * generateEmbeddings.js
 * Run with:  node src/scripts/generateEmbeddings.js
 */

import { PrismaClient } from "@prisma/client";
import { pipeline } from "@xenova/transformers";
import dotenv from "dotenv";
import { buildSearchText } from "../services/ai/recommendation/searchTextBuilder.js";

dotenv.config();

const prisma = new PrismaClient();
const BATCH_SIZE = 50;

async function generateEmbeddings() {
  try {
    console.log("⏳ Loading embedding model...");
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    // FIX: Use raw SQL to catch both NULL and {} — Prisma's { isEmpty: true }
    // only matches literal [] and misses NULL columns, causing 0 rows returned.
    console.log("📥 Finding schemes without embeddings (NULL or empty)...");
    const rawRows = await prisma.$queryRaw`
      SELECT id FROM "Scheme"
      WHERE "isActive" = true
        AND (embedding IS NULL OR array_length(embedding, 1) IS NULL OR array_length(embedding, 1) = 0)
    `;

    if (rawRows.length === 0) {
      console.log("✅ Nothing to do — all embeddings already generated.");
      return;
    }

    const ids = rawRows.map((r) => r.id);
    console.log(`📊 Found ${ids.length} schemes needing embeddings`);

    const schemes = await prisma.scheme.findMany({
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

    let success = 0;
    let failed  = 0;
    let updates = [];

    for (let i = 0; i < schemes.length; i++) {
      const scheme = schemes[i];

      try {
        const text = buildSearchText(scheme);

        if (!text.trim()) {
          console.warn(`⚠️  Empty search text for ${scheme.id} — skipping`);
          continue;
        }

        const output = await extractor(text, { pooling: "mean", normalize: true });
        updates.push({ id: scheme.id, embedding: Array.from(output.data) });

        if (updates.length >= BATCH_SIZE) {
          await prisma.$transaction(
            updates.map((u) =>
              prisma.scheme.update({ where: { id: u.id }, data: { embedding: u.embedding } })
            )
          );
          success += updates.length;
          updates = [];
          console.log(`✅ ${success} / ${schemes.length} done`);
        }
      } catch (err) {
        failed++;
        console.error(`❌ Failed ${scheme.id}: ${err.message}`);
      }
    }

    // Final partial batch
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.scheme.update({ where: { id: u.id }, data: { embedding: u.embedding } })
        )
      );
      success += updates.length;
      console.log(`✅ ${success} / ${schemes.length} done`);
    }

    console.log("\n🎉 COMPLETED");
    console.log(`✅ Success : ${success}`);
    console.log(`❌ Failed  : ${failed}`);
  } catch (err) {
    console.error("💥 Fatal error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateEmbeddings();