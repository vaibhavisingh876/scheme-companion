import { z } from "zod";

const sanitizeString = (value) =>
  typeof value === "string" ? value.toLowerCase().trim()||"unknown" : "unknown";

export const profileSchema = z.object({
  // ── Demographics ──────────────────────────────────────────────────────────
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
      "unknown",
    ])
    .catch("unknown"),

  state: z.string().transform(sanitizeString).default("unknown"),

  income: z.coerce.number().nonnegative().nullable().optional().default(null),

  educationLevel: z.string().transform(sanitizeString).default("unknown"),

  casteCategory: z
    .enum(["general", "sc", "st", "obc", "minority", "unknown"])
    .catch("unknown"),

  // ── Intent & Emotion ──────────────────────────────────────────────────────
  // FIX: these three fields were missing → Zod was silently stripping them,
  //      making the entire intent/emotion engine permanently return "unknown".

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
      "unknown",
    ])
    .catch("unknown")
    .default("unknown"),

  secondaryIntents: z.array(z.enum([
  "student","business","job",
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
  "startup-funding"
])).default([]),

  emotion: z
    .enum([
      "urgent",
      "worried",
      "desperate",
      "anxious",
      "frustrated",
      "hopeful",
      "calm",
      "unknown",
    ])
    .catch("unknown")
    .default("unknown"),

  // ── Confidence gates (optional, used for partial boosting) ────────────────
  intentConfidence: z.coerce.number().min(0).max(1).optional().default(0),
  emotionConfidence: z.coerce.number().min(0).max(1).optional().default(0),
});