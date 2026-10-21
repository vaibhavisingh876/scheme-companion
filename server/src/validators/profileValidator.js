import { z } from "zod";

const sanitizeString = (value) =>
  typeof value === "string"
    ? value.toLowerCase().trim() || "unknown"
    : "unknown";

const nullableNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  },
  z.number().min(0).max(120).nullable()
);

const nullableIncome = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  },
  z.number().nonnegative().nullable()
);

export const profileSchema = z.object({
  // Search-friendly paraphrase of the need, generated from the user's own
  // message. It is used only for semantic retrieval, never eligibility facts.
  searchQuery: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(1200).default("")
  ),

  age: nullableNumber,

  gender: z
    .enum([
      "male",
      "female",
      "other",
      "unknown",
    ])
    .catch("unknown"),

  occupation: z
    .enum([
      "student",
      "farmer",
      "startup",
      "worker",
      "housewife",
      "unemployed",
      "widow",
      "unknown",
    ])
    .catch("unknown"),

  state: z
    .preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase().trim() || "unknown" : "unknown"),
      z.string().default("unknown")
    ),

  income: nullableIncome,

  educationLevel: z
    .enum([
      "higher_education",
      "school",
      "unknown",
    ])
    .catch("unknown"),

  casteCategory: z
    .enum([
      "general",
      "sc",
      "st",
      "obc",
      "minority",
      "unknown",
    ])
    .catch("unknown"),

  primaryIntent: z
    .enum([
      "student",
      "business",
      "job",
      "medical",
      "treatment",
      "loan",
      "scholarship",
      "marriage",
      "death",
      "disability",
      "maternity",
      "farmer",
      "unemployed",
      "startup-funding",
      "widow-support",
      "housing",
      "sanitation",
      "pension",
      "unknown",
    ])
    .catch("unknown")
    .default("unknown"),
});
