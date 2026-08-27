import cron from "node-cron";
import { syncMyScheme } from "../sync/myschemeSync.js";
import { updateMissingEmbeddings } from "../../services/ai/embeddingService.js";

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

      await syncMyScheme();

      console.log("🤖 Checking Missing Embeddings...");
      await updateMissingEmbeddings();

      console.log("✅ Scheduled Sync Finished");
    } catch (err) {
      console.error("❌ Cron Error:", err);
    } finally {
      isSyncRunning = false;
    }
  });

  console.log("✅ MyScheme Cron Started");
};