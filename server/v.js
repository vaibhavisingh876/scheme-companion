import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://api.myscheme.gov.in/search/v6/schemes";

async function test() {
  try {
    const res = await axios.get(BASE_URL, {
      params: {
        lang: "en",
        q: "[]",
        keyword: "",
        sort: "",
        from: 0,
        size: 1,
      },
      headers: {
        "x-api-key": process.env.MYSCHEME_API_KEY,
        Origin: "https://www.myscheme.gov.in",
        Referer: "https://www.myscheme.gov.in/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: () => true,
    });

    console.log("STATUS:", res.status);
    console.log("DATA:");
    console.dir(res.data, { depth: null });
    console.log(HEADERS);
  } catch (e) {
    console.log(e.message);
    console.log(HEADERS);
  }
}

test();