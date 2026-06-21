import prisma from "../../config/prisma.js";
import { pipeline } from "@xenova/transformers";
import cache from "../../utils/cache.js";

let extractorInstance = null;

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const BATCH_SIZE = 5;

export const updateMissingEmbeddings = async () => {
  try {
    const totalSchemes = await prisma.scheme.count({
      where: {
        isActive: true,
      },
    });

    console.log(`📊 Total active schemes: ${totalSchemes}`);

    const allSchemes = await prisma.scheme.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        searchText: true,
        embedding: true,
      },
    });

    const schemesToUpdate = allSchemes.filter(
      (scheme) =>
        !Array.isArray(scheme.embedding) ||
        scheme.embedding.length === 0
    );

    console.log(
      `🔍 Missing embeddings found: ${schemesToUpdate.length}`
    );

    if (schemesToUpdate.length === 0) {
      console.log("✅ No missing embeddings found.");
      return;
    }

    console.log(
      `⏳ Generating embeddings for ${schemesToUpdate.length} schemes...`
    );

    if (!extractorInstance) {
      console.log("🤖 Loading embedding model...");

      extractorInstance = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );

      console.log("✅ Embedding model loaded.");
    }

    let successCount = 0;
    let failCount = 0;

    for (
      let i = 0;
      i < schemesToUpdate.length;
      i += BATCH_SIZE
    ) {
      const batch = schemesToUpdate.slice(
        i,
        i + BATCH_SIZE
      );

      await Promise.all(
        batch.map(async (scheme) => {
          try {
            const embeddingText = (
              scheme.searchText ||
              `${scheme.name || ""} ${scheme.description || ""} ${
                scheme.category || ""
              } ${
                Array.isArray(scheme.tags)
                  ? scheme.tags.join(" ")
                  : ""
              }`
            )
              .replace(/\s+/g, " ")
              .trim();

            const output = await extractorInstance(
              embeddingText,
              {
                pooling: "mean",
                normalize: true,
              }
            );

            await prisma.scheme.update({
              where: {
                id: scheme.id,
              },
              data: {
                embedding: Array.from(output.data),
              },
            });

            successCount++;
          } catch (err) {
            failCount++;

            console.error(
              `❌ Embedding failed for scheme ${scheme.id}`,
              err.message
            );
          }
        })
      );

      console.log(
        `✅ Progress: ${Math.min(
          i + BATCH_SIZE,
          schemesToUpdate.length
        )}/${schemesToUpdate.length} | Success: ${successCount} | Failed: ${failCount}`
      );

      // Neon ko rest
      await delay(500);
    }

    console.log(
      `🎉 Embedding generation completed. Success: ${successCount} | Failed: ${failCount}`
    );

    cache.del("schemes");
  } catch (error) {
    console.error(
      "❌ Embedding Service Error:",
      error.message
    );
  }
};