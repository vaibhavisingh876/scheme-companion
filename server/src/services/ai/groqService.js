import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import { profileSchema } from "../../validators/profileValidator.js";
import { profileCache } from "../../utils/cache.js";

const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are a profile extraction engine for Indian government scheme recommendations.

Extract structured information from the user message, which may be in English, Hindi, or Hinglish.

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

- Extract age only if clearly mentioned.
- Gender can be inferred from words or pronouns such as "mahila", "aadmi", etc.
- Extract occupation from the user's self-description.
- Return the state as the canonical Indian state or union territory name in lowercase.
- Normalize common abbreviations and alternate names.
  Examples:
  "UP" -> "uttar pradesh"
  "U.P." -> "uttar pradesh"
  "Uttar Pradesh" -> "uttar pradesh"
  "Dilli" -> "delhi"
  "Delhi" -> "delhi"
- Do not convert a city into a state unless the state is clearly implied by the city.
- Income must always be annual and in INR.
  Example: "3 lakh" -> 300000.
  Example: "monthly 25000" -> 300000.
- Education:
  "college", "university", "degree", "B.Tech" -> "higher_education"
  "school", "10th", "12th" -> "school"
- Caste:
  "general", "unreserved" -> "general"
  "SC" -> "sc"
  "ST" -> "st"
  "OBC" -> "obc"
  "minority", "muslim", "sikh" -> "minority"
  If not mentioned, use "unknown".
  Never assume "general".
- primaryIntent should be inferred from the user's main requirement.
  Examples:
  "scholarship chahiye" -> "scholarship"
  "naukri chahiye" -> "job"
  "kheti ke liye scheme" -> "farmer"
  If unclear, use "unknown".`;

export const extractUserProfile = async (message) => {
  const cacheKey = String(message).trim().toLowerCase().slice(0, 500);

  const cached = profileCache.get(cacheKey);

  if (cached) {
    console.log("Profile cache hit");
    return cached;
  }

  try {
    const response = await groqClientInstance.chat.completions.create({
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
    ]) {
      if (typeof parsed[field] === "string") {
        parsed[field] = parsed[field].toLowerCase().trim();
      }
    }

    parsed.age = parsed.age != null ? Number(parsed.age) : null;

    if (
      parsed.age !== null &&
      (isNaN(parsed.age) || parsed.age < 0 || parsed.age > 120)
    ) {
      parsed.age = null;
    }

    parsed.income =
      parsed.income != null ? Number(parsed.income) : null;

    if (
      parsed.income !== null &&
      (isNaN(parsed.income) || parsed.income < 0)
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

