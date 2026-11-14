/**
 * Shared utility helpers for text normalization, vector math, and async pacing.
 */

export const normalizeText = (text = "") =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeState = (state = "") =>
  String(state || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

export const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const HIGHER_EDUCATION_LEVELS = [
  "undergraduate",
  "postgraduate",
  "phd",
  "professional",
  "diploma",
];

export const SCHOOL_EDUCATION_LEVELS = [
  "below 10th",
  "9th",
  "10th",
  "11th",
  "12th",
];
