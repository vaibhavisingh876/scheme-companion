// groqService.js
import Groq from "groq-sdk";
import axios from "axios";
import { profileSchema } from "../../validators/profileValidator.js";
import { profileCache } from "../../utils/cache.js";
import { logger } from "../../utils/logger.js";

const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const normalize = (str = "") =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

// State map for normalization
const stateMap = {
  up: "uttarpradesh",
  uttarpradesh: "uttarpradesh",
  mp: "madhyapradesh",
  madhyapradesh: "madhyapradesh",
  dl: "delhi",
  delhi: "delhi",
  nctdelhi: "delhi",
  dilli: "delhi",
  mh: "maharashtra",
  maharashtra: "maharashtra",
  gujarat: "gujarat",
  gujrat: "gujarat",
  gj: "gujarat",
  pb: "punjab",
  punjab: "punjab",
  hr: "haryana",
  haryana: "haryana",
  kar: "karnataka",
  karnataka: "karnataka",
  tn: "tamilnadu",
  tamilnadu: "tamilnadu",
  tg: "telangana",
  telangana: "telangana",
  ap: "andhrapradesh",
  andhrapradesh: "andhrapradesh",
  rj: "rajasthan",
  rajasthan: "rajasthan",
  br: "bihar",
  bihar: "bihar",
  wb: "westbengal",
  westbengal: "westbengal",
  jk: "jammukashmir",
  jammukashmir: "jammukashmir",
  uk: "uttarakhand",
  uttarakhand: "uttarakhand",
  cg: "chhattisgarh",
  chhattisgarh: "chhattisgarh",
  odisha: "odisha",
  orissa: "odisha",
  assam: "assam",
  as: "assam",
  hp: "himachalpradesh",
  himachalpradesh: "himachalpradesh",
  goa: "goa",
  mn: "manipur",
  manipur: "manipur",
  mg: "meghalaya",
  meghalaya: "meghalaya",
  tr: "tripura",
  tripura: "tripura",
  sk: "sikkim",
  sikkim: "sikkim",
  ar: "arunachalpradesh",
  arunachalpradesh: "arunachalpradesh",
  naga: "nagaland",
  nagaland: "nagaland",
  mz: "mizoram",
  mizoram: "mizoram",
  jh: "jharkhand",
  jharkhand: "jharkhand",
  ch: "chandigarh",
  chandigarh: "chandigarh",
  puducherry: "puducherry",
  pondicherry: "puducherry",
  py: "puducherry",
  andamannicobar: "andamannicobar",
  ladakh: "ladakh",
  lakshadweep: "lakshadweep",
  kerala: "kerala",
};

export const normalizeState = (state = "") => {
  const cleaned = normalize(state);
  return stateMap[cleaned] || cleaned;
};

const extractJson = (content = "") => {
  try {
    return JSON.parse(content);
  } catch {}
  try {
    const match = content.match(/{[\s\S]*}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return {};
};

const defaultProfile = () =>
  profileSchema.parse({
    age: null,
    gender: "unknown",
    occupation: "unknown",
    state: "unknown",
    income: null,
    educationLevel: "unknown",
    casteCategory: "unknown",
    primaryIntent: "unknown",
  });

// ─── LLM SYSTEM PROMPT (unchanged) ────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert profile extraction engine for an Indian Government Schemes Recommendation System.
You MUST understand English, Hindi, Hinglish, and regional Indian language transliterations equally well.
Always extract every possible signal from the message.

═══ CRITICAL: CASTE CATEGORY EXTRACTION ═══
RULES:

If user says "general", "unreserved", "open category", "general category" → casteCategory MUST be "general"
If user says "SC", "scheduled caste", "dalit" → casteCategory MUST be "sc"
If user says "ST", "scheduled tribe", "tribal", "adivasi" → casteCategory MUST be "st"
If user says "OBC", "other backward class", "backward class" → casteCategory MUST be "obc"
If user says "minority", "muslim", "sikh", "christian", "jain", "buddhist", "parsi" → casteCategory MUST be "minority"
If not mentioned → "unknown"

⚠️ DO NOT assume "general" means "sc" or "st". They are different categories.

═══ CRITICAL: EDUCATION LEVEL ═══
RULES:

If user mentions "college", "university", "degree", "B.Sc", "B.A", "B.Com", "B.Tech", "M.Sc", "M.A", "MBA", "PG", "postgraduate", "higher education", "undergraduate", "final year", "pursuing" → educationLevel MUST be "higher_education"
If user mentions "school", "10th", "12th", "class 8", "class 9", "class 10", "class 11", "class 12", "matric", "secondary" → educationLevel MUST be "school"
If not mentioned → "unknown"

⚠️ BA final year, B.Sc, B.Com, B.Tech → ALL are "higher_education". NOT "school".

═══ HINDI/HINGLISH VOCABULARY ═══

OCCUPATIONS (extract from these signals):

kisan, kisaan, krishak, annadata, kheti, khet, fasal, kheti karta, kheti karti → occupation: "farmer", primaryIntent: "farmer"
vidyarthi, chhatra, padhai, padh raha, padh rahi, college, school, university, btech, mtech, engineering, ITI → occupation: "student"
majdoor, mazdoor, shramik, kamgar, mistri, construction, factory mein kaam → occupation: "worker"
vyapari, dukandaar, vyavsayi, shop, dukaan, business → occupation: "startup"
grihini, gharelu, ghar pe rehna, ghar sambhalna → occupation: "housewife"
berozgaar, naukri nahi, kaam nahi, job chahiye → occupation: "unemployed"
widow, vidhwa, patavya, pati nahi raha, pati guzar gaya, pati mar gaya, bereaved → occupation: "widow", primaryIntent: "widow-support"

STATES (abbreviated or spoken forms):

up, u.p., utar pradesh, uttar pradesh, lucknow → "Uttar Pradesh"
mp, m.p., madhya pradesh, bhopal → "Madhya Pradesh"
delhi, dilli, new delhi → "Delhi"
maharashtra, mumbai, pune, nagpur → "Maharashtra"
rajasthan, raj, jaipur → "Rajasthan"
bihar, br, patna → "Bihar"
west bengal, wb, bengal, kolkata → "West Bengal"
punjab, pb, chandigarh → "Punjab"
haryana, hr, gurugram, gurgaon → "Haryana"
gujarat, gj, ahmedabad, surat → "Gujarat"
karnataka, kar, bengaluru, bangalore → "Karnataka"
tamilnadu, tn, chennai → "Tamil Nadu"
kerala, thiruvananthapuram → "Kerala"

INTENT SIGNALS (map to primaryIntent):

yojana chahiye, scheme chahiye → extract intent from occupation/context
ilaaj, treatment, dawai, hospital, surgery, cancer → "treatment"
scholarship chahiye, padhai ke liye madad, fee support → "scholarship"
kheti ke liye, fasal ke liye, beej, khaad, crop → "farmer"
naukri chahiye, rojgaar chahiye → "job"
business karna chahta/chahti, dukaan kholni → "startup-funding"
widow pension, pati died, bereaved → "widow-support"
pregnant, delivery, garbhavati, prasav → "maternity"
disabled, divyang, handicapped → "disability"
ghar chahiye, makaan, awas → "housing"
toilet chahiye, shauchalay → "sanitation"
pension chahiye, vridha → "pension"
shaadi ke liye, vivah anudan → "marriage"
pati mara, breadwinner died, mrityu → "death"
loan chahiye, paisa chahiye, karz → "loan"

INCOME PARSING (always extract and convert to annual figure in INR):

"3 lakh" / "3L" / "3,00,000" → 300000
"8 lakh" → 800000
"monthly 25000" → 300000 (×12)
"daily 500" → 182500 (×365)
"weekly 3000" → 156000 (×52)
"1 crore" → 10000000
"below poverty line" / "bpl" → estimate 60000

AGE EXTRACTION:
"24 saal ka" → age: 24
"60 ke upar" → age: 62 (approximate above 60)
"baccha" / "child" without number → age: null
"budha" / "elderly" without number → age: 65 (approximate)

GENDER EXTRACTION:
"main ek aurat hu", "mai ladki hu", "mai mahila hu" → gender: "female"
"main ek aadmi hu", "mai mard hu", "mai ladka hu" → gender: "male"
"widow", "vidhwa", "pregnant", "mahila" → gender: "female"
Not mentioned → "unknown"

COMMON HINGLISH PATTERNS:
"mai ek X hu" → I am a X → extract X as occupation
"X se hu" or "X ka rehne wala hu" → from state X
"mujhe schemes bta" / "yojana btao" → user wants scheme recommendations
"hu" = "hoon" = "am" → identity marker
"se" = "from" → location marker
"bta" / "btao" = "tell me" → intent to find schemes
"chahiye" = "want/need"
"wala/wali" = person/one who does

Return ONLY valid JSON with these exact fields:
{
  "age": number | null,
  "gender": "male" | "female" | "other" | "unknown",
  "occupation": "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown",
  "state": string | "unknown",
  "income": number | null,
  "educationLevel": "higher_education" | "school" | "unknown",
  "casteCategory": "general" | "sc" | "st" | "obc" | "minority" | "unknown",
  "primaryIntent": "student" | "business" | "job" | "medical" | "treatment" | "loan" | "scholarship" | "marriage" | "death" | "disability" | "maternity" | "farmer" | "unemployed" | "startup-funding" | "widow-support" | "housing" | "sanitation" | "pension" | "unknown"
}`;

// ─── Profile Extraction ─────────────────────────────────────────────────
export const extractUserProfile = async (message) => {
  const cacheKey = normalize(message).slice(0, 500) || message;
  const cachedProfile = profileCache.get(cacheKey);
  if (cachedProfile) {
    logger.debug("Profile cache hit");
    return cachedProfile;
  }

  try {
    const response = await groqClientInstance.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
    });

    const rawContent = response?.choices?.[0]?.message?.content || "{}";
    const parsed = extractJson(rawContent);

    for (const f of [
      "gender",
      "occupation",
      "casteCategory",
      "state",
      "primaryIntent",
      "educationLevel",
    ]) {
      if (typeof parsed[f] === "string") parsed[f] = parsed[f].toLowerCase().trim();
    }

    if (parsed.age !== null && parsed.age !== undefined) {
      parsed.age = Number(parsed.age);
      if (Number.isNaN(parsed.age) || parsed.age < 0 || parsed.age > 120)
        parsed.age = null;
    }

    if (parsed.income !== null && parsed.income !== undefined) {
      parsed.income = Number(parsed.income);
      if (Number.isNaN(parsed.income) || parsed.income < 0) parsed.income = null;
    }

    const result = profileSchema.parse(parsed);
    result.state = normalizeState(result.state);

    profileCache.set(cacheKey, result);
    return result;
  } catch (err) {
    logger.error("[Groq Profile Extraction Error]", err);
    return defaultProfile();
  }
};

// ─── Fetch Scheme Detail from MyScheme API ────────────────────────────
export const fetchSchemeDetail = async (slug) => {
  try {
    const response = await axios.get(
      `https://api.myscheme.gov.in/schemes/v6/public/schemes?slug=${slug}&lang=en`,
      {
        headers: {
          "x-api-key": process.env.MYSCHEME_API_KEY,
          Origin: "https://www.myscheme.gov.in",
          Referer: "https://www.myscheme.gov.in/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        timeout: 10000,
      }
    );
    return response.data?.data?.en || null;
  } catch (err) {
    logger.error(`[fetchSchemeDetail] Error fetching ${slug}:`, err.message);
    return null;
  }
};