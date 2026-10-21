import cron from "node-cron";
import { syncMyScheme } from "../sync/myschemeSync.js";
import { updateMissingEmbeddings } from "../../services/ai/embeddingService.js";
import { invalidateCandidateCache, warmCandidateCache } from "../../services/ai/recommendation/recommendationService.js";

let isSyncRunning = false;

export const startMySchemeCron = () => {
  console.log("⏰ [CRON] Initializing MyScheme Cron Scheduler...");

  cron.schedule("0 */6 * * *", async () => {
    if (isSyncRunning) {
      console.warn("⚠️ Previous sync still running.");
      return;
    }

    try {
      isSyncRunning = true;

      console.log("⏰ Scheduled Sync Started");

      const result = await syncMyScheme();
      if (result?.success !== false) invalidateCandidateCache();

      console.log("🤖 Checking Missing Embeddings...");
      await updateMissingEmbeddings();
      invalidateCandidateCache();
      await warmCandidateCache();

      console.log("✅ Scheduled Sync Finished");
    } catch (err) {
      console.error("❌ Cron Error:", err);
    } finally {
      isSyncRunning = false;
    }
  });

  console.log("✅ MyScheme Cron Started");
};
