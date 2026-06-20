import cron from "node-cron";
import { syncMyScheme } from "../sync/myschemeSync.js";
import { updateMissingEmbeddings } from "../../services/ai/embeddingService.js";
let isSyncRunning = false;

// ⚡ Local testing handler logic function
const runSyncLogicManually = async () => {
  if (isSyncRunning) return;
  try {
    isSyncRunning = true;
    console.log("🚀 Testing Boot Loader: Executing instant startup verification sync...");
    
    // 1. Pehle data sync karo
    const syncResult = await syncMyScheme();
    
    // 2. Agar naye schemes add hue hain ya update hue hain, toh unke vectors turant bana do
    if (syncResult && (syncResult.added > 0 || syncResult.updated > 0)) {
       console.log(`🤖 Sync detected ${syncResult.added} new and ${syncResult.updated} updated schemes. Generating embeddings...`);
       await updateMissingEmbeddings();
    }
    
    console.log("🏁 Testing Boot Loader: Instant startup sync & embedding verification completed.");
  } catch (error) {
    console.error("❌ Startup testing crash trace:", error.message);
  } finally {
    isSyncRunning = false;
  }
};

export const startMySchemeCron = () => {
  // 1. Cron schedule as it is configured
  cron.schedule("0 */6 * * *", async () => {
    console.log("⏰ Scheduled synchronization checkpoint reached...");
    if (isSyncRunning) {
      console.warn("⚠️ Concurrency Block Warning: Previous synchronization sequence is still live.");
      return;
    }
    try {
      isSyncRunning = true;
      const syncResult = await syncMyScheme();
      
      // Yahan bhi Embeddings update call karni hai
      if (syncResult && (syncResult.added > 0 || syncResult.updated > 0)) {
         console.log(`🤖 Auto-Sync added/updated records. Triggering background embedding generation...`);
         await updateMissingEmbeddings();
      }

    } catch (cronError) {
      console.error("❌ Thread Error: Unhandled crash caught within cron execution worker hook:", cronError.message);
    } finally {
      isSyncRunning = false;
    }
  });

  console.log("✅ Sync scheduler registration locked down successfully (Interval target window: every 6 hours).");

  // 2. 🧪 TESTING TRIGGER
  runSyncLogicManually(); 
};