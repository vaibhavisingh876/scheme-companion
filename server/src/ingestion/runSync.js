import dotenv from "dotenv";
dotenv.config();

// Dynamic imports: connectors read MYSCHEME_API_KEY at module load, so env must
// be populated first.
const { syncMyScheme } = await import("./sync/myschemeSync.js");
const { updateMissingEmbeddings } = await import("../services/ai/embeddingService.js");

const result = await syncMyScheme();
console.log("📊 Sync result:", result);

if (result?.success !== false) {
  await updateMissingEmbeddings();
}

process.exit(result?.success === false ? 1 : 0);
