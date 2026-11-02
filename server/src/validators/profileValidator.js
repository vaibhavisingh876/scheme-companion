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
  z.number().min(0).max(120).nullable().catch(null)
);

const nullableIncome = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  },
  z.number().nonnegative().nullable().catch(null)
);

export const profileSchema = z.object({
  searchQuery: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(1200).default("")
  ),

  age: nullableNumber,

  gender: z.preprocess(
    sanitizeString,
    z.enum([
      "male",
      "female",
      "other",
      "unknown",
    ]).catch("unknown")
  ),

  occupation: z.preprocess(
    sanitizeString,
    z.enum([
      "student",
      "farmer",
      "startup",
      "worker",
      "housewife",
      "unemployed",
      "widow",
      "unknown",
    ]).catch("unknown")
  ),

  state: z.preprocess(
    (val) => (typeof val === "string" ? val.toLowerCase().trim() || "unknown" : "unknown"),
    z.string().default("unknown")
  ),

  income: nullableIncome,

  educationLevel: z.preprocess(
    sanitizeString,
    z.enum([
      "higher_education",
      "school",
      "unknown",
    ]).catch("unknown")
  ),

  casteCategory: z.preprocess(
    sanitizeString,
    z.enum([
      "general",
      "sc",
      "st",
      "obc",
      "minority",
      "unknown",
    ]).catch("unknown")
  ),

  primaryIntent: z.preprocess(
    sanitizeString,
    z.enum([
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
      .default("unknown")
  ),
});
