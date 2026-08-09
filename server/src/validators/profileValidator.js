import { z } from "zod";

const sanitizeString = (value) =>
  typeof value === "string" ? value.toLowerCase().trim() || "unknown" : "unknown";

export const profileSchema = z.object({
  age: z.coerce.number().min(0).max(120).nullable().optional().default(null),

  gender: z.enum(["male", "female", "other", "unknown"]).catch("unknown"),

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

  state: z.string().transform(sanitizeString).default("unknown"),

  income: z.coerce.number().nonnegative().nullable().optional().default(null),

  // educationLevel now restricted to specific values
  educationLevel: z
    .enum(["higher_education", "school", "unknown"])
    .catch("unknown"),

  casteCategory: z
    .enum(["general", "sc", "st", "obc", "minority", "unknown"])
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

  // Removed unused fields: secondaryIntents, emotion, intentConfidence, emotionConfidence
});