import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import { profileSchema } from "../../validators/profileValidator.js";
import { profileCache } from "../../utils/cache.js";

const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are a profile extraction engine for Indian government scheme recommendations.

Extract structured information from the user's message, which may be in English, Hindi, or Hinglish.

Return ONLY a valid JSON object with these exact fields:

{
  "age": number or null,
  "gender": "male" | "female" | "other" | "unknown",
  "occupation": "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown",
  "state": string,
  "income": number or null,
  "educationLevel": "higher_education" | "school" | "unknown",
  "casteCategory": "general" | "sc" | "st" | "obc" | "minority" | "unknown",
  "primaryIntent": "student" | "business" | "job" | "medical" | "treatment" | "loan" | "scholarship" | "marriage" | "death" | "disability" | "maternity" | "farmer" | "unemployed" | "startup-funding" | "widow-support" | "housing" | "sanitation" | "pension" | "unknown"
}

Rules:

- Extract age only when clearly stated.
- Do not infer age from education, occupation, or scheme context.

- Extract gender only when clearly stated or directly indicated by the user's words or pronouns.
- Do not infer gender from occupation or intent.

- Extract occupation only from the user's own description.
- Do not infer occupation from the scheme they are asking about.
- Examples:
  "I am a farmer" -> "farmer"
  "main student hoon" -> "student"
  "I run a startup" -> "startup"
  "I am looking for a job" -> "unknown" unless the user explicitly says they are unemployed.

- Return the state as the canonical Indian state or union territory name in lowercase.
- Normalize common abbreviations and alternate names.
  Examples:
  "UP" -> "uttar pradesh"
  "U.P." -> "uttar pradesh"
  "Uttar Pradesh" -> "uttar pradesh"
  "Dilli" -> "delhi"
  "Delhi" -> "delhi"
- Do not convert a city into a state unless the state is clearly implied by the user's statement.

- Income must always be annual and in INR.
- Convert monthly income to annual income.
  Examples:
  "3 lakh" -> 300000
  "3 lakh per year" -> 300000
  "monthly 25000" -> 300000
  "25k per month" -> 300000
- If income is not clearly stated, return null.
- Do not estimate income.

- Education:
  "college", "university", "degree", "B.Tech", "B.E.", "M.Tech", "MBA" -> "higher_education"
  "school", "10th", "12th", "class 10", "class 12" -> "school"
- If education is unclear, return "unknown".

- Caste:
  "general", "unreserved" -> "general"
  "SC", "scheduled caste" -> "sc"
  "ST", "scheduled tribe" -> "st"
  "OBC", "other backward class" -> "obc"
  "minority", "muslim", "sikh", "christian" -> "minority"
- If caste is not mentioned, return "unknown".
- Never assume "general".

- primaryIntent should represent the user's main requirement.
- Infer primaryIntent from the user's actual request, not from unrelated profile information.
- Examples:
  "scholarship chahiye" -> "scholarship"
  "naukri chahiye" -> "job"
  "kheti ke liye scheme" -> "farmer"
  "business ke liye loan chahiye" -> "loan"
  "ghar banane ke liye scheme" -> "housing"
- If the intent is unclear, return "unknown".`;

export const extractUserProfile = async (message) => {
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