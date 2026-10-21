import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import { profileSchema } from "../../validators/profileValidator.js";
import { profileCache } from "../../utils/cache.js";

const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const INDIAN_STATE_NAMES = [
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
  "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
  "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram",
  "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu",
  "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
  "andaman and nicobar islands", "chandigarh", "dadra and nagar haveli and daman and diu",
  "delhi", "jammu and kashmir", "ladakh", "lakshadweep", "puducherry",
];

const findExplicitState = (message) => {
  const normalizedMessage = String(message || "").toLowerCase().replace(/[.,]/g, " ");
  return INDIAN_STATE_NAMES
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((state) => new RegExp(`\\b${state}\\b`, "i").test(normalizedMessage));
};

const SYSTEM_PROMPT = `You are an expert profile extraction and query translation engine for Indian government scheme recommendations.

Extract structured information from the user's message, which may be in English, Hindi, or Hinglish.
Also rewrite the user's need as a search-friendly query using official terminology found in Indian government schemes, benefits, and eligibility criteria.

Return ONLY a valid JSON object with these exact fields:

{
  "searchQuery": "search-friendly description of the requested help using government scheme vocabulary",
  "age": number or null,
  "gender": "male" | "female" | "other" | "unknown",
  "occupation": "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown",
  "state": string,
  "income": number or null,
  "educationLevel": "higher_education" | "school" | "unknown",
  "casteCategory": "general" | "sc" | "st" | "obc" | "minority" | "unknown",
  "primaryIntent": "student" | "business" | "job" | "medical" | "treatment" | "loan" | "scholarship" | "marriage" | "death" | "disability" | "maternity" | "farmer" | "unemployed" | "startup-funding" | "widow-support" | "housing" | "sanitation" | "pension" | "unknown"
}

## 1. BENEFICIARY DETECTION (FIRST-PERSON VS. THIRD-PERSON) — CRITICAL:

Identify who the requested scheme or assistance is actually for:
- SPEAKER: The person writing or speaking the prompt (e.g., "I am a student...", "main college student hoon...").
- BENEFICIARY: The person who will actually receive the government scheme, financial assistance, treatment, or benefit.

RULES FOR ATTRIBUTES:
- Extract 'age', 'gender', 'occupation', 'income', 'educationLevel', and 'casteCategory' ONLY for the BENEFICIARY!
- If the user asks for help for themselves, Beneficiary = User.
- If the user asks for help for a family member or third party (e.g., "for my father", "meri maa ke liye", "my daughter", "my wife", "for my son", "meri dadi", etc.), that person is the BENEFICIARY!
- NEVER assign the speaker's occupation, age, or education to a third-party beneficiary!
  Example: "I am a student and I don't earn much at this age and my father's income is less than 3 lakhs per annum and I want to take a loan for my father for his cancer treatment."
  -> Beneficiary is FATHER.
  -> gender: "male" (father)
  -> occupation: "unknown" (the father is NOT a student! Do NOT put student!)
  -> age: null (father's age is not given)
  -> educationLevel: "unknown"
  -> income: 300000 (father's income ceiling is 3 lakh)
  -> primaryIntent: "medical" or "treatment" (treatment of cancer / medical assistance, NOT education or general student loan!)
  -> searchQuery: "financial assistance for cancer treatment, medical care financial aid, critical illness treatment loan, health welfare scheme, cancer patient relief fund"
- Relationship to Gender mapping:
  "father", "pitaji", "papa", "husband", "pati", "son", "beta", "brother", "bhai", "dada", "nana" -> "male"
  "mother", "mataji", "maa", "mom", "wife", "patni", "daughter", "beti", "sister", "behen", "dadi", "nani", "widow", "vidhwa" -> "female"
- State: If a state is stated anywhere in the message ("we live in UP", "Delhi se hu"), apply it to the beneficiary unless explicitly given otherwise.

## 2. searchQuery INSTRUCTIONS — CRITICAL:

searchQuery is used for semantic search against a database of government scheme descriptions and eligibility criteria.
Ordinary users use informal words ("ilaaj ke liye paisa", "loan for father cancer", "ghar banana hai", "scholarship for 12th pass girl").
Government schemes use formal, official vocabulary.

Translate the user's need into 3-5 concise, comma-separated search phrases using official Indian government scheme terminology:
- Medical / Illness / Cancer: "financial assistance for cancer treatment, medical care financial aid, critical illness treatment loan, health welfare scheme, cancer patient relief fund, Ayushman Bharat"
- Eye Surgery / Senior Medical: "financial assistance for eye surgery, medical treatment subsidy, senior citizen health welfare, national health mission assistance"
- Education / Scholarship: "post-matric scholarship, higher education financial assistance, merit-cum-means scholarship, tuition fee reimbursement"
- Farmer / Agriculture: "Pradhan Mantri Fasal Bima Yojana, crop insurance, agricultural risk coverage, compensation for crop damage, Kisan Credit Card"
- Business / Startup / Shop: "MUDRA loan, PMEGP, self-employment financial assistance, startup seed fund, micro enterprise loan"
- Housing: "Pradhan Mantri Awas Yojana, housing subsidy, rural housing assistance, financial assistance for house construction"
- Widow / Destitute women: "widow pension scheme, financial assistance for widows, destitute women welfare, social security pension"
- Always keep searchQuery in English for optimal embedding matching.

## 3. PROFILE EXTRACTION RULES:

- Age: Extract only when clearly stated for the beneficiary. Do not infer from education or occupation.
- Gender: "male" | "female" | "other" | "unknown".
- Occupation: "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown". Only from the beneficiary's self-description.
- State: Canonical Indian state or union territory in lowercase (e.g., "uttar pradesh", "delhi", "bihar", "maharashtra").
- Income: Always annual in INR.
  - Understand ceiling / threshold phrases:
    "3 lakh" / "3L" / "3,00,000" -> 300000
    "less than 3 lakhs", "below 3 lakh", "under 3L", "3 lakh se kam", "upto 3 lakh", "income is less than 3 lakhs per annum" -> 300000
    "family income 2 lakh", "parivar ki aamdani 2 lakh se kam" -> 200000
    "monthly 25000" -> annualize: 300000
  - If income is not mentioned, return null.
- EducationLevel:
  "higher_education": college, university, degree, B.Tech, M.Tech, MBA, graduation
  "school": school, 10th, 12th, class 10, class 12, matric
  Else: "unknown"
- CasteCategory: "general" | "sc" | "st" | "obc" | "minority" | "unknown". If unmentioned, return "unknown". Never assume "general".
- PrimaryIntent: Must represent the beneficiary's true need:
  - When help is for medical treatment, cancer, surgery, illness, hospital care, set to "treatment" or "medical" (even if the user asks for a "loan" or "paisa" to pay for it!).
  - "scholarship chahiye" -> "scholarship"
  - "naukri chahiye" -> "job"
  - "ghar banane ke liye" -> "housing"
  - "kheti ke liye" -> "farmer"
  - "widow pension" -> "widow-support" or "pension"
  - If unclear -> "unknown".`;

export const extractUserProfile = async (message, metrics = {}) => {
  const cacheKey = String(message)
    .trim()
    .toLowerCase()
    .slice(0, 500);

  const cached = profileCache.get(cacheKey);

  if (cached) {
    console.log("Profile cache hit");
    return cached;
  }

  try {
    metrics.onLLMCall?.();
    const response =
      await groqClientInstance.chat.completions.create({
        model: "openai/gpt-oss-120b",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: message,
          },
        ],
      });
    metrics.onUsage?.(response?.usage || {});

    const rawContent =
      response?.choices?.[0]?.message?.content || "{}";

    const parsed = JSON.parse(rawContent);

    for (const field of [
      "gender",
      "occupation",
      "casteCategory",
      "educationLevel",
      "primaryIntent",
      "state",
    ]) {
      if (typeof parsed[field] === "string") {
        parsed[field] = parsed[field]
          .toLowerCase()
          .trim();
      } else {
        parsed[field] = "unknown";
      }
    }

    if (parsed.state === "unknown") {
      parsed.state = findExplicitState(message) || "unknown";
    }

    parsed.searchQuery =
      typeof parsed.searchQuery === "string"
        ? parsed.searchQuery.trim().slice(0, 1200)
        : "";

    parsed.age =
      parsed.age != null
        ? Number(parsed.age)
        : null;

    if (
      parsed.age !== null &&
      (Number.isNaN(parsed.age) ||
        parsed.age < 0 ||
        parsed.age > 120)
    ) {
      parsed.age = null;
    }

    parsed.income =
      parsed.income != null
        ? Number(parsed.income)
        : null;

    if (
      parsed.income !== null &&
      (Number.isNaN(parsed.income) ||
        parsed.income < 0)
    ) {
      parsed.income = null;
    }

    const result = profileSchema.parse(parsed);

    profileCache.set(cacheKey, result);

    return result;
  } catch (err) {
    console.error("====================================");
    console.error("[Groq Profile Extraction Error]");
    console.error("Message:", err?.message);
    console.error("Status:", err?.status);
    console.error("Code:", err?.code);
    console.error("Error:", err);
    console.error("====================================");

    throw err;
  }
};
