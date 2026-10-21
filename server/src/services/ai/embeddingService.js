import prisma from "../../config/prisma.js";
import { getExtractor } from "./embeddingModel.js";

const BATCH_SIZE = 5;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const buildDescriptionEmbeddingText = (scheme) => {
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

export const buildEligibilityEmbeddingText = (scheme) => {
  return String(scheme.eligibility || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const generateEmbeddings = async (scheme, extractor, { force = false } = {}) => {
  const data = {};
  const needsDescription = force || !scheme.descriptionEmbedding?.length;
  const needsEligibility = (force || !scheme.eligibilityEmbedding?.length) && Boolean(String(scheme.eligibility || "").trim());
  const descriptionText = needsDescription ? buildDescriptionEmbeddingText(scheme) : "";
  const eligibilityText = needsEligibility ? buildEligibilityEmbeddingText(scheme) : "";

  if (needsDescription && !descriptionText) throw new Error("Missing description text");

  const pending = [];
  if (needsDescription) {
    pending.push(extractor(descriptionText, { pooling: "mean", normalize: true }).then((out) => {
      data.descriptionEmbedding = Array.from(out.data);
    }));
  }
  if (needsEligibility) {
    pending.push(extractor(eligibilityText, { pooling: "mean", normalize: true }).then((out) => {
      data.eligibilityEmbedding = Array.from(out.data);
    }));
  }
  await Promise.all(pending);
  return data;
};

const processSchemes = async (schemes, extractor, { force = false } = {}) => {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < schemes.length; i += BATCH_SIZE) {
    const batch = schemes.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (scheme) => {
        try {
          const embeddings = await generateEmbeddings(scheme, extractor, { force });

          await prisma.scheme.update({
            where: { id: scheme.id },
            data: embeddings,
          });

          successCount++;
        } catch (err) {
          failCount++;

          console.error(
            `❌ Embedding failed for scheme ${scheme.id}:`,
            err.message
          );
        }
      })
    );

    console.log(
      `✅ Progress: ${Math.min(i + BATCH_SIZE, schemes.length)}/${schemes.length} | ✓ ${successCount} | ✗ ${failCount}`
    );

    await delay(500);
  }

  return {
    successCount,
    failCount,
  };
};

const schemeSelect = {
  id: true,
  name: true,
  description: true,
  benefits: true,
  eligibility: true,
  descriptionEmbedding: true,
  eligibilityEmbedding: true,
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
};

/**
 * Regenerates embeddings for ALL active schemes.
 */
export const regenerateAllEmbeddings = async () => {
  try {
    const schemes = await prisma.scheme.findMany({
      where: {
        isActive: true,
      },
      select: schemeSelect,
    });

    console.log(
      `🔍 Regenerating embeddings for ${schemes.length} active schemes...`
    );

    const extractor = await getExtractor();

    const { successCount, failCount } = await processSchemes(
      schemes,
      extractor,
      { force: true }
    );

    console.log(
      `🎉 Embedding regeneration complete. Success: ${successCount} | Failed: ${failCount}`
    );
  } catch (error) {
    console.error(
      "❌ Embedding regeneration error:",
      error.message
    );
  }
};

/**
 * Updates embeddings only for schemes that have missing embeddings.
 */
export const updateMissingEmbeddings = async () => {
  try {
    const rawRows = await prisma.$queryRaw`
      SELECT id
      FROM "Scheme"
      WHERE "isActive" = true
        AND (
          (
            ("descriptionEmbedding" IS NULL OR array_length("descriptionEmbedding", 1) IS NULL OR array_length("descriptionEmbedding", 1) = 0)
            AND btrim(concat_ws(' ', "name", "description", "benefits")) <> ''
          )
          OR
          (
            ("eligibilityEmbedding" IS NULL OR array_length("eligibilityEmbedding", 1) IS NULL OR array_length("eligibilityEmbedding", 1) = 0)
            AND btrim(coalesce("eligibility", '')) <> ''
          )
        )
    `;

    if (rawRows.length === 0) {
      console.log("✅ All embeddings up to date.");
      return;
    }

    const ids = rawRows.map((row) => row.id);

    console.log(
      `🔍 Schemes needing embeddings: ${ids.length}`
    );

    const schemesToUpdate = await prisma.scheme.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: schemeSelect,
    });

    const extractor = await getExtractor();

    const { successCount, failCount } = await processSchemes(
      schemesToUpdate,
      extractor
    );

    console.log(
      `🎉 Embeddings complete. Success: ${successCount} | Failed: ${failCount}`
    );
  } catch (error) {
    console.error(
      "❌ Embedding Service Error:",
      error.message
    );
  }
};
