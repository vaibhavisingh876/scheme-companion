import axios from "axios";

const BASE_URL = "https://www.myscheme.gov.in/api/apisetu/schemes";
const API_KEY = process.env.MYSCHEME_API_KEY;

if (!API_KEY) {
  console.error("❌ MYSCHEME_API_KEY environment variable is not set.");
}

const HEADERS = {
  "x-api-key": API_KEY,
  Origin: "https://www.myscheme.gov.in",
  Referer: "https://www.myscheme.gov.in/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// The apisetu catalog endpoint ignores from/size and returns every scheme in one
// response as { _id, slug, en: { basicDetails } } — an index, not full details.
export const fetchAllMySchemes = async () => {
  if (!API_KEY) {
    console.error("❌ MYSCHEME_API_KEY missing. Cannot fetch bulk schemes.");
    return [];
  }

  console.log("🚀 Starting MyScheme apisetu catalog fetch...");

  let retryCount = 0;
  const maxRetries = 5;

  while (retryCount < maxRetries) {
    try {
      const response = await axios.get(BASE_URL, {
        params: { lang: "en" },
        headers: HEADERS,
        timeout: 120000,
        validateStatus: () => true,
      });

      if (response.status === 429) {
        retryCount++;
        console.warn(`⚠️ Rate limited. Waiting 60s... (${retryCount}/${maxRetries})`);
        await delay(60000);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        console.error("❌ Authentication failed.");
        return [];
      }

      if (response.status >= 500) {
        retryCount++;
        console.error(`⚠️ Server error ${response.status}. Retry ${retryCount}/${maxRetries}`);
        await delay(5000);
        continue;
      }

      if (response.status !== 200) {
        retryCount++;
        console.error(`⚠️ Unexpected status ${response.status}. Retry ${retryCount}/${maxRetries}`);
        await delay(5000);
        continue;
      }

      const raw = response.data?.data;
      const items = Array.isArray(raw) ? raw : Object.values(raw || {});

      const catalog = items
        .map((item) => ({
          _id: item?._id || null,
          slug: item?.slug || null,
          name: item?.en?.basicDetails?.schemeName || "",
        }))
        .filter((item) => item.slug);

      console.log(`✅ Catalog fetch done: ${catalog.length} schemes`);
      return catalog;
    } catch (err) {
      retryCount++;
      console.error(`⚠️ Error: ${err.message}`);
      if (retryCount >= maxRetries) break;
      await delay(5000);
    }
  }

  return [];
};
