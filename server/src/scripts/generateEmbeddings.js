import { PrismaClient } from "@prisma/client";
import { pipeline } from "@xenova/transformers";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const BATCH_SIZE = 50;

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
  const parts = [
    `eligibility: ${scheme.eligibility || ""}`,
    `occupations: ${(scheme.allowedOccupations || []).join(" ")}`,
    `categories: ${(scheme.allowedCategories || []).join(" ")}`,
    `genders: ${(scheme.allowedGenders || []).join(" ")}`,
    `states: ${(scheme.allowedStates || []).join(" ")}`,
    `education: ${(scheme.allowedEducationLevels || []).join(" ")}`,
    `minimum age: ${scheme.minAge ?? ""}`,
    `maximum age: ${scheme.maxAge ?? ""}`,
    `minimum income: ${scheme.minIncome ?? ""}`,
    `maximum income: ${scheme.maxIncome ?? ""}`,
    `scholarship: ${scheme.isScholarship ? "yes" : "no"}`,
    `female only: ${scheme.isFemaleOnly ? "yes" : "no"}`,
  ];

  return parts
    .filter((part) => part.trim())
    .join(" | ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const buildCombinedText = (descriptionText, eligibilityText) => {
  return `${descriptionText} | ${eligibilityText}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

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
          OR "embedding" IS NULL
          OR array_length("embedding", 1) IS NULL
          OR array_length("embedding", 1) = 0
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
    let updates = [];

    for (let i = 0; i < schemes.length; i++) {
      const scheme = schemes[i];

      try {
        const descriptionText = buildDescriptionText(scheme);
        const eligibilityText = buildEligibilityText(scheme);

        if (!descriptionText || !eligibilityText) {
          console.warn(
            `⚠️ Missing text for ${scheme.id} — skipping`
          );
          continue;
        }

        const combinedText = buildCombinedText(
          descriptionText,
          eligibilityText
        );

        const [
          descriptionOutput,
          eligibilityOutput,
          combinedOutput,
        ] = await Promise.all([
          extractor(descriptionText, {
            pooling: "mean",
            normalize: true,
          }),
          extractor(eligibilityText, {
            pooling: "mean",
            normalize: true,
          }),
          extractor(combinedText, {
            pooling: "mean",
            normalize: true,
          }),
        ]);

        updates.push({
          id: scheme.id,
          descriptionEmbedding: Array.from(descriptionOutput.data),
          eligibilityEmbedding: Array.from(eligibilityOutput.data),
          embedding: Array.from(combinedOutput.data),
        });

        if (updates.length >= BATCH_SIZE) {
          await prisma.$transaction(
            updates.map((u) =>
              prisma.scheme.update({
                where: { id: u.id },
                data: {
                  descriptionEmbedding: u.descriptionEmbedding,
                  eligibilityEmbedding: u.eligibilityEmbedding,
                  embedding: u.embedding,
                },
              })
            )
          );

          success += updates.length;
          updates = [];

          console.log(
            `✅ ${success} / ${schemes.length} done`
          );
        }
      } catch (err) {
        failed++;

        console.error(
          `❌ Failed ${scheme.id}: ${err.message}`
        );
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.scheme.update({
            where: { id: u.id },
            data: {
              descriptionEmbedding: u.descriptionEmbedding,
              eligibilityEmbedding: u.eligibilityEmbedding,
              embedding: u.embedding,
            },
          })
        )
      );

      success += updates.length;

      console.log(
        `✅ ${success} / ${schemes.length} done`
      );
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

