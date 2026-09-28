import prisma from "../../config/prisma.js";
import { getExtractor } from "./embeddingModel.js";
import { buildSearchText } from "../ai/recommendation/searchTextBuilder.js";

const BATCH_SIZE = 5;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const generateEmbeddings = async (scheme, extractor) => {
  const descriptionText = buildDescriptionText(scheme);
  const eligibilityText = buildEligibilityText(scheme);
  const searchText = buildSearchText(scheme);

  if (!descriptionText || !eligibilityText) {
    throw new Error("Missing description or eligibility text");
  }

  const [descriptionOutput, eligibilityOutput, combinedOutput] =
    await Promise.all([
      extractor(descriptionText, {
        pooling: "mean",
        normalize: true,
      }),
      extractor(eligibilityText, {
        pooling: "mean",
        normalize: true,
      }),
      extractor(searchText, {
        pooling: "mean",
        normalize: true,
      }),
    ]);

  return {
    descriptionEmbedding: Array.from(descriptionOutput.data),
    eligibilityEmbedding: Array.from(eligibilityOutput.data),
    embedding: Array.from(combinedOutput.data),
  };
};

const processSchemes = async (schemes, extractor) => {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < schemes.length; i += BATCH_SIZE) {
    const batch = schemes.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (scheme) => {
        try {
          const embeddings = await generateEmbeddings(scheme, extractor);

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

  return { successCount, failCount };
};

const schemeSelect = {
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
};

/**
 * Regenerates embeddings for ALL active schemes.
 */
export const regenerateAllEmbeddings = async () => {
  try {
    const schemes = await prisma.scheme.findMany({
      where: { isActive: true },
      select: schemeSelect,
    });

    console.log(
      `🔍 Regenerating embeddings for ${schemes.length} active schemes...`
    );

    const extractor = await getExtractor();

    const { successCount, failCount } = await processSchemes(
      schemes,
      extractor
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
          "descriptionEmbedding" IS NULL
          OR array_length("descriptionEmbedding", 1) IS NULL
          OR array_length("descriptionEmbedding", 1) = 0
          OR "eligibilityEmbedding" IS NULL
          OR array_length("eligibilityEmbedding", 1) IS NULL
          OR array_length("eligibilityEmbedding", 1) = 0
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

