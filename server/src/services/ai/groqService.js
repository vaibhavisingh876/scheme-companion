/**
 * groqService.js
 *
 * LLM-powered profile extraction + query expansion.
 *
 * IMPROVEMENT LOG:
 * - Massively expanded system prompt with more Hindi/Hinglish examples
 * - Added housing, sanitation, pension, marriage, death as primary intents
 * - Added explicit age signal extraction examples
 * - Added income parsing examples (monthly → annual, lakh, crore)
 * - Improved query expansion prompt to produce scheme-corpus-aligned vocabulary
 * - Added caste-category extraction examples
 * - Added secondary intent extraction guidance
 */

import Groq from "groq-sdk";
import { profileSchema } from "../../validators/profileValidator.js";

const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const normalize = (str = "") =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const stateMap = {
  up: "uttarpradesh", uttarpradesh: "uttarpradesh",
  mp: "madhyapradesh", madhyapradesh: "madhyapradesh",
  dl: "delhi", delhi: "delhi", nctdelhi: "delhi", dilli: "delhi",
  mh: "maharashtra", maharashtra: "maharashtra",
  gujarat: "gujarat", gujrat: "gujarat", gj: "gujarat",
  pb: "punjab", punjab: "punjab",
  hr: "haryana", haryana: "haryana",
  kar: "karnataka", karnataka: "karnataka",
  tn: "tamilnadu", tamilnadu: "tamilnadu",
  tg: "telangana", telangana: "telangana",
  ap: "andhrapradesh", andhrapradesh: "andhrapradesh",
  rj: "rajasthan", rajasthan: "rajasthan",
  br: "bihar", bihar: "bihar",
  wb: "westbengal", westbengal: "westbengal",
  jk: "jammukashmir", jammukashmir: "jammukashmir",
  uk: "uttarakhand", uttarakhand: "uttarakhand",
  cg: "chhattisgarh", chhattisgarh: "chhattisgarh",
  odisha: "odisha", orissa: "odisha",
  assam: "assam", as: "assam",
  hp: "himachalpradesh", himachalpradesh: "himachalpradesh",
  goa: "goa",
  mn: "manipur", manipur: "manipur",
  mg: "meghalaya", meghalaya: "meghalaya",
  tr: "tripura", tripura: "tripura",
  sk: "sikkim", sikkim: "sikkim",
  ar: "arunachalpradesh", arunachalpradesh: "arunachalpradesh",
  naga: "nagaland", nagaland: "nagaland",
  mz: "mizoram", mizoram: "mizoram",
  jh: "jharkhand", jharkhand: "jharkhand",
  ch: "chandigarh", chandigarh: "chandigarh",
  puducherry: "puducherry", pondicherry: "puducherry", py: "puducherry",
  andamannicobar: "andamannicobar",
  ladakh: "ladakh",
  lakshadweep: "lakshadweep",
  kerala: "kerala",
};

const occupationMap = {
  student:    ["student","engineeringstudent","medicalstudent","learner","college","school","btech","mtech","bsc","msc","ba","ma","bcom","mcom","mba","bca","mca","university","vidyarthi","chhatra"],
  farmer:     ["farmer","agriculture","agricultureworker","kisan","kisaan","cultivator","farming","khet","fasal","krishak","annadata","kisaan","kheti"],
  startup:    ["startup","entrepreneur","business","businessman","businesswoman","shopowner","trader","merchant","msme","selfemployed","self-employed","vyapari","dukandaar","udyog","vyavsayi"],
  worker:     ["worker","labour","labourer","mazdoor","employee","constructionworker","artisan","craftsman","carpenter","welder","shramik","majdoor","kamgar","mistri"],
  unemployed: ["jobless","unemployed","jobseeker","lookingforjob","berozgaar","naukri","berozgaari"],
  housewife:  ["housewife","homemaker","grihini","gharelu","gruhini"],
  widow:      ["widow","patavya","bereaved","bereavedwife","deceasedhusband","widowed","vidhwa"],
};

export const normalizeState = (state = "") => {
  const cleaned = normalize(state);
  return stateMap[cleaned] || cleaned;
};

export const normalizeOccupation = (occupation = "") => {
  const cleaned = normalize(occupation);
  for (const key in occupationMap) {
    if (occupationMap[key].some((kw) => cleaned.includes(kw))) return key;
  }
  return cleaned || "unknown";
};

const extractJson = (content = "") => {
  try { return JSON.parse(content); } catch {}
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return {};
};

const defaultProfile = () =>
  profileSchema.parse({
    age: null, gender: "unknown", occupation: "unknown", state: "unknown",
    income: null, educationLevel: "unknown", casteCategory: "unknown",
    primaryIntent: "unknown", secondaryIntents: [], emotion: "unknown",
    intentConfidence: 0, emotionConfidence: 0,
  });

// ── System prompt (the most important part of LLM extraction quality) ─────────
const SYSTEM_PROMPT = `You are an expert profile extraction engine for an Indian Government Schemes Recommendation System.
You MUST understand English, Hindi, Hinglish, and regional Indian language transliterations equally well.
Always extract every possible signal from the message.

═══ HINDI/HINGLISH VOCABULARY ═══

OCCUPATIONS (extract from these signals):
- kisan, kisaan, krishak, annadata, kheti, khet, fasal, kheti karta, kheti karti → occupation: "farmer", primaryIntent: "farmer"
- vidyarthi, chhatra, padhai, padh raha, padh rahi, college, school, university, btech, mtech, engineering, ITI → occupation: "student"
- majdoor, mazdoor, shramik, kamgar, mistri, construction, factory mein kaam → occupation: "worker"
- vyapari, dukandaar, vyavsayi, shop, dukaan, business → occupation: "startup"
- grihini, gharelu, ghar pe rehna, ghar sambhalna → occupation: "housewife"
- berozgaar, naukri nahi, kaam nahi, job chahiye → occupation: "unemployed"
- widow, vidhwa, patavya, pati nahi raha, pati guzar gaya, pati mar gaya, bereaved → occupation: "widow", primaryIntent: "widow-support"

STATES (abbreviated or spoken forms):
- up, u.p., utar pradesh, uttar pradesh, lucknow → "Uttar Pradesh"
- mp, m.p., madhya pradesh, bhopal → "Madhya Pradesh"
- delhi, dilli, new delhi → "Delhi"
- maharashtra, mumbai, pune, nagpur → "Maharashtra"
- rajasthan, raj, jaipur → "Rajasthan"
- bihar, br, patna → "Bihar"
- west bengal, wb, bengal, kolkata → "West Bengal"
- punjab, pb, chandigarh → "Punjab"
- haryana, hr, gurugram, gurgaon → "Haryana"
- gujarat, gj, ahmedabad, surat → "Gujarat"
- karnataka, kar, bengaluru, bangalore → "Karnataka"
- tamilnadu, tn, chennai → "Tamil Nadu"
- kerala, thiruvananthapuram → "Kerala"

INTENT SIGNALS (map to primaryIntent):
- yojana chahiye, scheme chahiye → extract intent from occupation/context
- ilaaj, treatment, dawai, hospital, surgery, cancer → "treatment"
- scholarship chahiye, padhai ke liye madad, fee support → "scholarship"
- kheti ke liye, fasal ke liye, beej, khaad, crop → "farmer"
- naukri chahiye, rojgaar chahiye → "job"
- business karna chahta/chahti, dukaan kholni → "startup-funding"
- widow pension, pati died, bereaved → "widow-support"
- pregnant, delivery, garbhavati, prasav → "maternity"
- disabled, divyang, handicapped → "disability"
- ghar chahiye, makaan, awas → "housing"
- toilet chahiye, shauchalay → "sanitation"
- pension chahiye, vridha → "pension"
- shaadi ke liye, vivah anudan → "marriage"
- pati mara, breadwinner died, mrityu → "death"
- loan chahiye, paisa chahiye, karz → "loan"

INCOME PARSING (always extract and convert to annual figure in INR):
- "3 lakh" / "3L" / "3,00,000" → 300000
- "8 lakh" → 800000
- "monthly 25000" → 300000 (×12)
- "daily 500" → 182500 (×365)
- "weekly 3000" → 156000 (×52)
- "1 crore" → 10000000
- "below poverty line" / "bpl" → estimate 60000

AGE EXTRACTION:
- "24 saal ka" → age: 24
- "60 ke upar" → age: 62 (approximate above 60)
- "baccha" / "child" without number → age: null
- "budha" / "elderly" without number → age: 65 (approximate)

EDUCATION LEVEL:
- engineering, btech, b.tech, college, degree, graduation, university, mtech, mba, phd, UG, PG, postgraduate → "higher_education"
- ITI, polytechnic, diploma → "higher_education"
- school, 10th, 12th, matric, intermediate, secondary → "school"
- Not mentioned → "unknown"

CASTE CATEGORY:
- SC, dalit, scheduled caste, "main SC hu" → "sc"
- ST, tribal, adivasi, "main ST hu" → "st"
- OBC, other backward class, "OBC hu" → "obc"
- minority, muslim, sikh, christian, jain, buddhist → "minority"
- general, open category, unreserved → "general"
- Not mentioned → "unknown"

GENDER EXTRACTION:
- "main ek aurat hu", "mai ladki hu", "mai mahila hu" → gender: "female"
- "main ek aadmi hu", "mai mard hu", "mai ladka hu" → gender: "male"
- "widow", "vidhwa", "pregnant", "mahila" → gender: "female"
- Not mentioned → "unknown"

COMMON HINGLISH PATTERNS:
- "mai ek X hu" → I am a X → extract X as occupation
- "X se hu" or "X ka rehne wala hu" → from state X
- "mujhe schemes bta" / "yojana btao" → user wants scheme recommendations
- "hu" = "hoon" = "am" → identity marker
- "se" = "from" → location marker
- "bta" / "btao" = "tell me" → intent to find schemes
- "chahiye" = "want/need"
- "wala/wali" = person/one who does

SECONDARY INTENTS: extract additional needs from the message.
e.g. "student loan ke liye" → primaryIntent: "scholarship", secondaryIntents: ["loan"]
e.g. "farmer + medical treatment" → primaryIntent: "farmer", secondaryIntents: ["treatment"]

Return ONLY valid JSON with these exact fields:
{
  "age": number | null,
  "gender": "male" | "female" | "other" | "unknown",
  "occupation": "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown",
  "state": string | "unknown",
  "income": number | null,
  "educationLevel": "higher_education" | "school" | "unknown",
  "casteCategory": "general" | "sc" | "st" | "obc" | "minority" | "unknown",
  "primaryIntent": "student" | "business" | "job" | "medical" | "treatment" | "loan" | "scholarship" | "marriage" | "death" | "disability" | "maternity" | "farmer" | "unemployed" | "startup-funding" | "widow-support" | "housing" | "sanitation" | "pension" | "unknown",
  "secondaryIntents": string[],
  "emotion": "urgent" | "worried" | "desperate" | "anxious" | "frustrated" | "hopeful" | "calm" | "unknown",
  "intentConfidence": number between 0.0 and 1.0,
  "emotionConfidence": number between 0.0 and 1.0
}`;

export const extractUserProfile = async (message) => {
  try {
    const response = await groqClientInstance.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.15,   // Slightly lower temperature for more consistent extraction
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: message },
      ],
    });

    const rawContent = response?.choices?.[0]?.message?.content || "{}";
    const parsed     = extractJson(rawContent);

    for (const f of ["gender","occupation","casteCategory","state","primaryIntent","educationLevel"]) {
      if (typeof parsed[f] === "string") parsed[f] = parsed[f].toLowerCase().trim();
    }

    if (parsed.age !== null && parsed.age !== undefined) {
      parsed.age = Number(parsed.age);
      if (Number.isNaN(parsed.age) || parsed.age < 0 || parsed.age > 120) parsed.age = null;
    }

    if (parsed.income !== null && parsed.income !== undefined) {
      parsed.income = Number(parsed.income);
      if (Number.isNaN(parsed.income) || parsed.income < 0) parsed.income = null;
    }

    parsed.secondaryIntents  = Array.isArray(parsed.secondaryIntents) ? parsed.secondaryIntents : [];
    parsed.intentConfidence  = Math.min(1, Math.max(0, Number(parsed.intentConfidence)  || 0.5));
    parsed.emotionConfidence = Math.min(1, Math.max(0, Number(parsed.emotionConfidence) || 0.5));

    parsed.state      = normalizeState(parsed.state);
    parsed.occupation = normalizeOccupation(parsed.occupation);

    return profileSchema.parse(parsed);
  } catch (err) {
    console.error("[Groq Profile Extraction Error]", err);
    return defaultProfile();
  }
};

// ── Query expansion for better embedding matching ─────────────────────────────
export const expandQueryForEmbedding = async (rawMessage, profile) => {
  try {
    const prompt = `You are a search query rewriter for an Indian government scheme recommendation system.

Your task: Rewrite the user's message into a RICH, DETAILED paragraph using vocabulary that would appear in government scheme descriptions.

Rules:
1. Write only in English (no Hindi script, but transliterated Hindi words like "kisan", "mahila" are okay)
2. Include: occupation type, state, age group, income level, specific need/intent
3. Use government scheme vocabulary: "financial assistance", "subsidy", "welfare", "beneficiary", "eligibility"
4. Include both English and common Hindi transliterations for key concepts (e.g. "farmer / kisan / krishak")
5. Keep it under 150 words — dense with relevant keywords
6. NO markdown, NO bullet points, NO preamble — just the rewritten paragraph

User message: "${rawMessage}"

Extracted profile:
- Occupation: ${profile.occupation}
- State: ${profile.state}
- Age: ${profile.age ?? "not mentioned"}
- Income: ${profile.income != null ? `₹${profile.income} per year` : "not mentioned"}
- Education: ${profile.educationLevel}
- Caste: ${profile.casteCategory}
- Primary need: ${profile.primaryIntent}
- Secondary needs: ${(profile.secondaryIntents || []).join(", ") || "none"}
- Gender: ${profile.gender}

Rewritten query (English only, government vocabulary, keyword-rich):`;

    const response = await groqClientInstance.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const result = response?.choices?.[0]?.message?.content?.trim() || "";
    // Reject if the model returned something too short or in JSON format
    if (result.length < 30 || result.startsWith("{")) return rawMessage;
    return result;
  } catch (err) {
    console.warn("Query expansion failed, using original message.", err.message);
    return rawMessage;
  }
};