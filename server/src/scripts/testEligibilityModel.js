import { PrismaClient } from "@prisma/client";
import { pipeline } from "@xenova/transformers";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();


// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}


async function testSchemes() {
  try {
    // 1. Load MiniLM model
    console.log("🤖 Loading MiniLM model...\n");

    const model = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

    console.log("✅ Model loaded!\n");


    // 2. Education categories we want to test
    const educationLabels = [
      "Eligibility for students who have completed class 10",
      "Eligibility for students who have completed class 12",
      "Eligibility for diploma holders",
      "Eligibility for undergraduate or bachelor's degree holders",
      "Eligibility for postgraduate or master's degree holders",
    ];


    // 3. Generate embeddings for education labels
    console.log("📚 Creating education label embeddings...\n");

    const educationEmbeddings = {};

    for (const label of educationLabels) {
      const result = await model(label, {
        pooling: "mean",
        normalize: true,
      });

      educationEmbeddings[label] = result.data;
    }

    console.log("✅ Education label embeddings created!\n");


    // 4. Fetch schemes from database
    console.log("📥 Fetching schemes from database...\n");

    const schemes = await prisma.scheme.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        eligibility: true,
        allowedEducationLevels: true,
        allowedGenders: true,
        allowedOccupations: true,
      },
      take: 10,
    });

    console.log(`Found ${schemes.length} schemes\n`);


    // 5. Test every scheme
    for (const scheme of schemes) {
      console.log("==============================================");
      console.log(`📌 ${scheme.name}`);
      console.log("==============================================");

      console.log("\nEligibility:");
      console.log(scheme.eligibility || "N/A");


      // Generate embedding for scheme eligibility
      const result = await model(scheme.eligibility || "", {
        pooling: "mean",
        normalize: true,
      });

      const schemeEmbedding = result.data;


      // 6. Compare scheme with every education category
      const scores = educationLabels
        .map((label) => {
          const score = cosineSimilarity(
            schemeEmbedding,
            educationEmbeddings[label]
          );

          return {
            label,
            score,
          };
        })
        .sort((a, b) => b.score - a.score);


      // 7. Print results
      console.log("\n🤖 Education similarity:");

      for (const item of scores) {
        console.log(
          `${item.label.padEnd(65)} ${item.score.toFixed(3)}`
        );
      }


      // 8. Current database values for comparison
      console.log("\n🗄️ Current normalized education:");
      console.log(scheme.allowedEducationLevels);

      console.log("\n");
    }

  } catch (error) {
    console.error("❌ Error:", error);

  } finally {
    await prisma.$disconnect();
  }
}

testSchemes();