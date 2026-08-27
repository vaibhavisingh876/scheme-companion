import dotenv from "dotenv";
dotenv.config();
import Groq from "groq-sdk";
import { profileSchema } from "../../validators/profileValidator.js";
import { profileCache } from "../../utils/cache.js";

const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ── Very simple state normalization map ──────────────────────
const stateMap = {
  up: "uttar pradesh",
  uttarpradesh: "uttar pradesh",
  mp: "madhya pradesh",
  madhyapradesh: "madhya pradesh",
  delhi: "delhi",
  dilli: "delhi",
  mumbai: "maharashtra",
  maharashtra: "maharashtra",
  punjab: "punjab",
  haryana: "haryana",
  gujarat: "gujarat",
  karnataka: "karnataka",
  tamilnadu: "tamil nadu",
  kerala: "kerala",
  rajasthan: "rajasthan",
  bihar: "bihar",
  westbengal: "west bengal",
  // add more if needed, but keep it minimal
};

const normalizeState = (raw) => {
  const cleaned = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return stateMap[cleaned] || cleaned || "unknown";
};

// ── JSON extractor with correct regex ─────────────────────────
const extractJson = (content) => {
  try {
    return JSON.parse(content);
  } catch {}
  try {
    const match = content.match(/{[\s\S]*}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return {};
};

// ── Fallback default profile ──────────────────────────────────
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

// ── Simplified system prompt ──────────────────────────────────
const SYSTEM_PROMPT = `You are a profile extraction engine for Indian government scheme recommendations.
Extract structured information from the user message (which may be in English, Hindi, Hinglish).

Return ONLY a JSON object with these exact fields:
{
  "age": number or null,
  "gender": "male" | "female" | "other" | "unknown",
  "occupation": "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown",
  "state": string (state name as mentioned, e.g. "Uttar Pradesh", "Delhi", "UP". Do not convert city to state, just use what user said.),
  "income": number (annual in INR) or null,
  "educationLevel": "higher_education" | "school" | "unknown",
  "casteCategory": "general" | "sc" | "st" | "obc" | "minority" | "unknown",
  "primaryIntent": "student" | "business" | "job" | "medical" | "treatment" | "loan" | "scholarship" | "marriage" | "death" | "disability" | "maternity" | "farmer" | "unemployed" | "startup-funding" | "widow-support" | "housing" | "sanitation" | "pension" | "unknown"
}

Rules:
- Extract age if clearly mentioned (e.g., "I'm 22 years old" -> age: 22).
- Gender from pronouns or words like "mahila", "aadmi".
- Occupation from self-description (e.g., "kisan", "student", "housewife"). Use "unknown" if not clear.
- State as the user says it; we will normalize later.
- Income: always annual. "3 lakh" -> 300000, "monthly 25000" -> 300000. If not mentioned, null.
- Education: "college/university/degree/B.Tech" -> "higher_education"; "school/10th/12th" -> "school"; else "unknown".
- Caste: "general/unreserved" -> "general", "SC" -> "sc", "ST" -> "st", "OBC" -> "obc", "minority/muslim/sikh" -> "minority". If not mentioned, use "unknown". DO NOT assume "general".
- primaryIntent: infer from keywords like "scholarship", "kheti", "treatment", "naukri", etc. Use "unknown" if unclear.`;

export const extractUserProfile = async (message) => {
  const cacheKey = String(message).trim().toLowerCase().slice(0, 500);
  const cached = profileCache.get(cacheKey);
  if (cached) {
    console.log("Profile cache hit");
    return cached;
  }

  try {
    const response = await groqClientInstance.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
    });

    const rawContent = response?.choices?.[0]?.message?.content || "{}";
    const parsed = extractJson(rawContent);

    // Normalize string fields
    for (const f of ["gender", "occupation", "casteCategory", "educationLevel", "primaryIntent"]) {
      if (typeof parsed[f] === "string") parsed[f] = parsed[f].toLowerCase().trim();
    }

    // Fix age and income numbers
    parsed.age = parsed.age != null ? Number(parsed.age) : null;
    if (parsed.age !== null && (isNaN(parsed.age) || parsed.age < 0 || parsed.age > 120)) parsed.age = null;

    parsed.income = parsed.income != null ? Number(parsed.income) : null;
    if (parsed.income !== null && (isNaN(parsed.income) || parsed.income < 0)) parsed.income = null;

    // Validate with schema
    const result = profileSchema.parse(parsed);
    // Normalize state using our map (city->state already removed from prompt, we just clean the string)
    result.state = normalizeState(result.state);
    // caste remains as extracted, "unknown" stays unknown.

    profileCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[Groq Profile Extraction Error]", err);
    return defaultProfile();
  }
};