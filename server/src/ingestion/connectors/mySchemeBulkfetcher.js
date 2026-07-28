import axios from "axios";

const BASE_URL = "https://api.myscheme.gov.in/search/v6/schemes";

const HEADERS = {
  "x-api-key": process.env.MYSCHEME_API_KEY || "",
  Origin: "https://www.myscheme.gov.in",
  Referer: "https://www.myscheme.gov.in/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const fetchAllMySchemes = async () => {
  const allSchemes = [];
  let from = 0;
  const size = 50;
  let total = null;
  let retryCount = 0;
  const maxRetries = 10;

  console.log("🚀 Starting MyScheme v6 bulk fetch engine (ultra‑conservative mode)...");

  // 🧊 Very long initial wait to reset the rate limiter window
  const INITIAL_WAIT = 120; // 2 minutes
  console.log(`⏳ Initial cooldown ${INITIAL_WAIT}s to clear rate limits...`);
  await delay(INITIAL_WAIT * 1000);

  while (true) {
    try {
      console.log(`📥 Requesting offset ${from} (page size ${size})`);

      const response = await axios.get(BASE_URL, {
        params: { lang: "en", q: "[]", keyword: "", sort: "", from, size },
        headers: HEADERS,
        timeout: 30000,
        validateStatus: () => true,
      });

      // ── Rate limit ──────────────────────────────────────────────────
      if (response.status === 429) {
        retryCount++;
        // Wait 5 minutes on first 429, then 10 minutes, 15 minutes...
        const waitSeconds = 300 + (retryCount - 1) * 300;
        console.warn(
          `⚠️ Rate limited (429). Waiting ${waitSeconds}s... (Attempt ${retryCount}/${maxRetries})`
        );
        if (retryCount >= maxRetries) {
          console.error(
            "❌ Too many 429s – stopping bulk fetch. Partial data will be used."
          );
          return allSchemes;
        }
        await delay(waitSeconds * 1000);
        continue;
      }

      // ── Server errors ──────────────────────────────────────────────
      if (response.status >= 500) {
        retryCount++;
        console.error(`⚠️ Server error ${response.status}. Retry ${retryCount}/${maxRetries}`);
        if (retryCount >= maxRetries) throw new Error("Persistent 5xx errors");
        await delay(retryCount * 5000);
        continue;
      }

      // ── Success ────────────────────────────────────────────────────
      retryCount = 0;

      const hits = response.data?.data?.hits?.items || [];
      const page = response.data?.data?.hits?.page;

      if (total === null) {
        total = page?.total || 0;
        console.log(`📊 Total schemes reported: ${total}`);
      }

      if (hits.length > 0) {
        allSchemes.push(...hits);
        console.log(`📦 Got ${hits.length} items → cumulative ${allSchemes.length}`);
        from += size;
      } else {
        console.log("🏁 No more hits. Done.");
        break;
      }

      if (total && allSchemes.length >= total) {
        console.log("🏁 Reached total. Done.");
        break;
      }

      // 🧊 Very long pause between pages
      console.log(`⏸️  Waiting 10s before next page...`);
      await delay(10000);
    } catch (err) {
      retryCount++;
      console.error(`⚠️ Network fault (Attempt ${retryCount}/${maxRetries}) – ${err.message}`);
      if (retryCount >= maxRetries) {
        console.error("❌ Too many network faults – returning partial data.");
        return allSchemes;
      }
      await delay(retryCount * 10000);
    }
  }

  console.log(`✅ Bulk fetch finished. Total pulled: ${allSchemes.length}`);
  return allSchemes;
};