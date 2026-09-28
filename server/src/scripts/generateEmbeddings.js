import { PrismaClient } from "@prisma/client";
import { pipeline } from "@xenova/transformers";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const INFERENCE_BATCH_SIZE = 32;
const DB_BATCH_SIZE = 64;
const EMBEDDING_DIMENSION = 384;

const buildDescriptionText = (scheme) => {
  const parts = [
    `name: ${scheme.name || ""}`,
    `description: ${scheme.description || ""}`,
    `benefits: ${scheme.benefits || ""}`,
    `category: ${scheme.category || ""}`,
    `ministry: ${scheme.ministry || ""}`,
    `tags: ${(scheme.tags || []).join(" ")}`,
    `scheme for: ${scheme.schemeFor || ""}`,
  ];

  return parts
    .filter((part) => part.trim())
    .join(" | ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const buildEligibilityText = (scheme) => {
  return String(scheme.eligibility || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const getEmbedding = (output, index) => {
  const start = index * EMBEDDING_DIMENSION;
  const end = start + EMBEDDING_DIMENSION;

  return Array.from(output.data.slice(start, end));
};

async function saveUpdates(updates) {
  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.scheme.update({
        where: { id: u.id },
        data: {
          descriptionEmbedding: u.descriptionEmbedding,
          eligibilityEmbedding: u.eligibilityEmbedding,
        },
      })
    )
  );
}

async function generateEmbeddings() {
  try {
    console.log("⏳ Loading embedding model...");

    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

    console.log("📥 Finding schemes without embeddings...");

    const rawRows = await prisma.$queryRaw`
      SELECT id
      FROM "Scheme"
      WHERE "isActive" = true
        AND (
          "descriptionEmbedding" IS NULL
          OR array_length("descriptionEmbedding", 1) IS NULL
          OR array_length("descriptionEmbedding", 1) = 0
          OR "eligibilityEmbedding" IS NULL
          OR array_length("eligibilityEmbedding", 1) IS NULL
          OR array_length("eligibilityEmbedding", 1) = 0
        )
    `;

    if (rawRows.length === 0) {
      console.log("✅ Nothing to do — all embeddings already generated.");
      return;
    }

    const ids = rawRows.map((row) => row.id);

    console.log(
      `📊 Found ${ids.length} schemes needing embeddings`
    );

    const schemes = await prisma.scheme.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        benefits: true,
        eligibility: true,
        category: true,
        ministry: true,
        tags: true,
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
      },
    });

    let success = 0;
    let failed = 0;
    let skipped = 0;
    let updates = [];

    for (
      let i = 0;
      i < schemes.length;
      i += INFERENCE_BATCH_SIZE
    ) {
      const batch = schemes.slice(
        i,
        i + INFERENCE_BATCH_SIZE
      );

      const validSchemes = [];
      const descriptionTexts = [];
      const eligibilityTexts = [];

      for (const scheme of batch) {
        const descriptionText = buildDescriptionText(scheme);
        const eligibilityText = buildEligibilityText(scheme);

        if (!descriptionText || !eligibilityText) {
          skipped++;
          console.warn(
            `⚠️ Missing text for ${scheme.id} — skipping`
          );
          continue;
        }

        validSchemes.push(scheme);
        descriptionTexts.push(descriptionText);
        eligibilityTexts.push(eligibilityText);
      }

      if (validSchemes.length === 0) {
        continue;
      }

      try {
        const [
          descriptionOutput,
          eligibilityOutput,
        ] = await Promise.all([
          extractor(descriptionTexts, {
            pooling: "mean",
            normalize: true,
          }),
          extractor(eligibilityTexts, {
            pooling: "mean",
            normalize: true,
          }),
        ]);

        for (let j = 0; j < validSchemes.length; j++) {
          updates.push({
            id: validSchemes[j].id,
            descriptionEmbedding: getEmbedding(
              descriptionOutput,
              j
            ),
            eligibilityEmbedding: getEmbedding(
              eligibilityOutput,
              j
            ),
          });
        }

        success += validSchemes.length;

        if (updates.length >= DB_BATCH_SIZE) {
          await saveUpdates(updates);
          updates = [];
        }

        console.log(
          `✅ ${Math.min(
            i + batch.length,
            schemes.length
          )} / ${schemes.length} processed`
        );
      } catch (err) {
        failed += validSchemes.length;

        console.error(
          `❌ Batch failed (${i + 1}-${i + batch.length}): ${err.message}`
        );
      }
    }

    if (updates.length > 0) {
      await saveUpdates(updates);
      updates = [];
    }

    console.log("\n🎉 COMPLETED");
    console.log(`✅ Success : ${success}`);
    console.log(`❌ Failed  : ${failed}`);
    console.log(`⚠️ Skipped : ${skipped}`);
  } catch (err) {
    console.error("💥 Fatal error:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

generateEmbeddings();