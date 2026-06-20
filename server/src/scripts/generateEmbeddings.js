import { PrismaClient } from "@prisma/client";
import { pipeline } from "@xenova/transformers";

const prisma = new PrismaClient();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateEmbeddings() {
  try {
    console.log("⏳ Initializing transformer model...");

    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

    console.log("📥 Loading active schemes from database...");

    const schemes = await prisma.scheme.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`📊 Generating embeddings for ${schemes.length} schemes...`);

    const updates = [];

    for (let i = 0; i < schemes.length; i++) {
      const scheme = schemes[i];

      try {
        // FIX BUG 3: Use searchText instead of just name/description/category/tags.
        // searchText is built by the normalizer and includes occupation, education,
        // gender, state, caste category, and scholarship keywords — all the fields
        // that drive filtering and scoring. Using only name+desc+category produces
        // weaker embeddings where "kisan UP" queries don't hit farmer schemes.
        // Fallback to name+description+category+tags if searchText is missing.
        const embeddingText = (
          scheme.searchText ||
          `${scheme.name || ""} ${scheme.description || ""} ${scheme.category || ""} ${Array.isArray(scheme.tags) ? scheme.tags.join(" ") : ""}`
        )
          .replace(/\s+/g, " ")
          .trim();

        const output = await extractor(embeddingText, {
          pooling: "mean",
          normalize: true,
        });

        updates.push(
          prisma.scheme.update({
            where: { id: scheme.id },
            data: { embedding: Array.from(output.data) },
          })
        );

        // Batch update every 20 records
        if (updates.length >= 20) {
          await Promise.all(updates);
          updates.length = 0;
          // Small delay between batches so Neon doesn't throttle connections
          await delay(100);
        }

        if (i > 0 && i % 50 === 0) {
          console.log(`✅ Progress: ${i}/${schemes.length} embeddings generated`);
          await delay(200);
        }
      } catch (innerError) {
        console.error(
          `❌ Failed embedding generation for scheme ${scheme.id}:`,
          innerError.message
        );
      }
    }

    // Remaining updates
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    console.log("🎉 All embeddings generated and stored successfully.");
  } catch (error) {
    console.error("🛑 Embedding generation failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

generateEmbeddings();