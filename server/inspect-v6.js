// test-v6-detail.js
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

const API_KEY = process.env.MYSCHEME_API_KEY;
const SLUG = "scossi";  // change to any slug you want to inspect

const fetchDetail = async () => {
  console.log(`🔎 Fetching details for slug: ${SLUG}\n`);

  try {
    const res = await axios.get(
      `https://api.myscheme.gov.in/schemes/v6/public/schemes?slug=${SLUG}&lang=en`,
      {
        headers: {
          "x-api-key": API_KEY,
          Origin: "https://www.myscheme.gov.in",
          Referer: "https://www.myscheme.gov.in/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    // ⬇️ PRINT THE FULL RAW RESPONSE (the entire API payload)
    console.log("📦 FULL RAW RESPONSE (res.data):");
    console.log(JSON.stringify(res.data, null, 2));
    
    // Optionally, also print just the English data block separately
    const data = res.data?.data?.en;
    if (data) {
      console.log("\n📦 ENGLISH DATA BLOCK (data.en):");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log("❌ No English data found.");
    }

  } catch (err) {
    console.error("❌ Error fetching detail:", err.response?.status, err.message);
  }
};

fetchDetail();