import prisma from "../../config/prisma.js";
import { pipeline } from "@xenova/transformers";
import cache from "../../utils/cache.js";

let extractorInstance = null;

export const updateMissingEmbeddings = async () => {
  try {
    const schemesToUpdate = await prisma.scheme.findMany({
      where: {
        isActive: true,
        embedding: {
          equals: [],
        },
      },
    });

    if (schemesToUpdate.length === 0) {
      console.log("✅ No missing embeddings found.");
      return;
    }

    console.log(`⏳ Generating embeddings for ${schemesToUpdate.length} schemes...`);

    if (!extractorInstance) {
      extractorInstance = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
    }

    const updates = [];

    for (const scheme of schemesToUpdate) {
      try {
        // FIX BUG 3: Use searchText instead of just name/description/category/tags.
        // searchText includes occupation, education, gender, state, caste, and
        // scholarship keywords — producing richer, more accurate embeddings.
        // Fallback to name+description+category+tags if searchText is missing.
        const embeddingText = (
          scheme.searchText ||
          `${scheme.name || ""} ${scheme.description || ""} ${scheme.category || ""} ${Array.isArray(scheme.tags) ? scheme.tags.join(" ") : ""}`
        )
          .replace(/\s+/g, " ")
          .trim();

        const output = await extractorInstance(embeddingText, {
          pooling: "mean",
          normalize: true,
        });

        updates.push(
          prisma.scheme.update({
            where: { id: scheme.id },
            data: { embedding: Array.from(output.data) },
          })
        );

        if (updates.length >= 20) {
          await Promise.all(updates);
          updates.length = 0;
        }
      } catch (err) {
        console.error(`❌ Embedding failed for scheme ${scheme.id}`, err.message);
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    console.log("✨ Missing embeddings generated successfully.");

    cache.del("schemes");
  } catch (error) {
    console.error("❌ Embedding Service Error:", error.message);
  }
};