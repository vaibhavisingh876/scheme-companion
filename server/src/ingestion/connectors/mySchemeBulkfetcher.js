import axios from "axios";

const BASE_URL = "https://api.myscheme.gov.in/search/v6/schemes";
const API_KEY = process.env.MYSCHEME_API_KEY;

if (!API_KEY) {
  console.error("❌ MYSCHEME_API_KEY environment variable is not set.");
}

const HEADERS = {
  "x-api-key": API_KEY,
  Origin: "https://www.myscheme.gov.in",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "sec-fetch-site": "same-site",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const fetchAllMySchemes = async () => {
  const allSchemes = [];
  let from = 0;
  const size = 50;
  let total = null;
  let retryCount = 0;
  const maxRetries = 5;

  if (!API_KEY) {
    console.error("❌ MYSCHEME_API_KEY missing. Cannot fetch bulk schemes.");
    return allSchemes;
  }

  console.log("🚀 Starting MyScheme v6 bulk fetch engine...");

  while (true) {
    try {
      console.log(`📥 Requesting offset ${from} (page size ${size})`);

      const response = await axios.get(BASE_URL, {
        params: { lang: "en", q: "[]", keyword: "", sort: "", from, size },
        headers: HEADERS,
        timeout: 30000,
        validateStatus: () => true,
      });

      if (response.status === 429) {
        retryCount++;
        const waitSeconds = 60;
        console.warn(`⚠️ Rate limited. Waiting ${waitSeconds}s...`);
        if (retryCount >= maxRetries) {
          console.error("❌ Too many 429s – stopping.");
          return allSchemes;
        }
        await delay(waitSeconds * 1000);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        console.error("❌ Authentication failed.");
        return allSchemes;
      }

      if (response.status >= 500) {
        retryCount++;
        console.error(`⚠️ Server error ${response.status}. Retry ${retryCount}/${maxRetries}`);
        if (retryCount >= maxRetries) return allSchemes;
        await delay(5000);
        continue;
      }

      retryCount = 0;

      const hits = response.data?.data?.hits?.items || [];
      const page = response.data?.data?.hits?.page;

      if (total === null) {
        total = page?.total || 0;
        console.log(`📊 Total schemes: ${total}`);
      }

      if (hits.length > 0) {
        allSchemes.push(...hits);
        console.log(`📦 ${hits.length} items → ${allSchemes.length}/${total}`);
        from += size;
      } else {
        break;
      }

      if (total && allSchemes.length >= total) break;

      await delay(500);
    } catch (err) {
      retryCount++;
      console.error(`⚠️ Error: ${err.message}`);
      if (retryCount >= maxRetries) return allSchemes;
      await delay(5000);
    }
  }

  console.log(`✅ Bulk fetch done: ${allSchemes.length}`);
  return allSchemes;
};