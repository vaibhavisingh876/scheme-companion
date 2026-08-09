import axios from "axios";

const BASE_URL = "https://api.myscheme.gov.in/schemes/v6/public/schemes";
const API_KEY = process.env.MYSCHEME_API_KEY;
const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000;

const getHeaders = () => {
  if (!API_KEY) throw new Error("MYSCHEME_API_KEY missing.");
  return {
    "x-api-key": API_KEY,
    Origin: "https://www.myscheme.gov.in",
    Referer: "https://www.myscheme.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchSchemeDetail = async (slug) => {
  if (!API_KEY) {
    console.error("❌ MYSCHEME_API_KEY missing.");
    return null;
  }

  let retries = 0;
  while (retries <= MAX_RETRIES) {
    try {
      const response = await axios.get(BASE_URL, {
        headers: getHeaders(),
        params: { slug, lang: "en" },
        timeout: 30000,
        validateStatus: () => true,
      });

      if (response.status === 200 && response.data?.data?.en) {
        return response.data.data.en;
      }

      if (response.status === 403 || response.status === 404) {
        console.warn(`⚠️ ${response.status} for ${slug} – skipping`);
        return null;
      }

      if (response.status === 429) {
        const waitTime = INITIAL_DELAY * Math.pow(2, retries);
        console.warn(`⏳ 429 for ${slug}, retry ${retries+1}/${MAX_RETRIES} after ${waitTime}ms`);
        await sleep(waitTime);
        retries++;
        continue;
      }

      console.warn(`⚠️ Detail fetch failed for ${slug} (${response.status}) – retrying...`);
      retries++;
      await sleep(INITIAL_DELAY);
    } catch (err) {
      console.error(`❌ Network error for ${slug}: ${err.message}`);
      if (retries < MAX_RETRIES) {
        const waitTime = INITIAL_DELAY * Math.pow(2, retries);
        await sleep(waitTime);
        retries++;
      } else {
        return null;
      }
    }
  }
  console.error(`❌ Failed to fetch ${slug} after ${MAX_RETRIES} retries.`);
  return null;
};