import { pipeline } from "@xenova/transformers";

let extractorInstance = null;

export const getExtractor = async () => {
  if (!extractorInstance) {
    console.log("🤖 Loading embedding model (Xenova/all-MiniLM-L6-v2)...");
    extractorInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Embedding model loaded.");
  }
  return extractorInstance;
};