import axios from "axios";

const BASE_URL = "https://api.myscheme.gov.in/search/v4/schemes";

const HEADERS = {
  "x-api-key": process.env.MYSCHEME_API_KEY || "",
  Origin: "https://www.myscheme.gov.in",
  Referer: "https://www.myscheme.gov.in/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

export const fetchAllMySchemes = async () => {
  const allSchemes = [];
  let from = 0;
  const size = 100;
  let total = null;
  let retryCount = 0;
  const maxRetries = 3;

  console.log("🚀 Starting MyScheme stable bulk fetch engine...");

  while (true) {
    try {
      console.log(`📥 Requesting API Payload Chunk at offset: ${from}`);

      const response = await axios.get(BASE_URL, {
        params: {
          lang: "en",
          q: "[]",
          keyword: "",
          sort: "",
          from,
          size,
        },
        headers: HEADERS,
        timeout: 25000, // Safe 25-second limit threshold
      });

      const hits = response.data?.data?.hits?.items || [];
      const page = response.data?.data?.hits?.page;

      if (total === null) {
        total = page?.total || 0;
        console.log(`📊 TOTAL ACTIVE SCHEMES REPORTED BY API: ${total}`);
      }

      // If page has records, append them and reset retry counter
      if (hits.length > 0) {
        allSchemes.push(...hits);
        console.log(`📦 Fetched ${hits.length} items | Total cumulative: ${allSchemes.length}`);
        from += size;
        retryCount = 0; // Reset consecutive error trackers
      }

      // Check termination triggers safely
      if (!hits.length || (total && allSchemes.length >= total)) {
        console.log("🏁 Reached absolute boundary configuration threshold map target.");
        break;
      }

    } catch (err) {
      retryCount++;
      console.error(`⚠️ Network fault at offset ${from} (Attempt ${retryCount}/${maxRetries})`);
      
      if (retryCount >= maxRetries) {
        console.error("❌ Critical API limit breakdown. HALTING operation sequence to protect downstream DB records.");
        // Throwing error stops partial sync execution, protecting active schemes from unintentional mass deactivation.
        throw new Error(`MyScheme data pull crashed on offset ${from}: ${err.message}`);
      }

      const backoffDelay = retryCount * 3000;
      console.log(`⏳ Exponential cooldown backoff applied. Waiting ${backoffDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  console.log(`✅ BULK STREAM INGESTION FINISHED. Total pulled: ${allSchemes.length}`);
  return allSchemes;
};