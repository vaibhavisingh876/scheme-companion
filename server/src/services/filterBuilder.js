// searchTextBuilder.js

/**
 * Build a concise searchText for embedding generation.
 *
 * The searchText is used exclusively for semantic similarity (cosine).
 * It should be a dense, keyword‑rich representation of the scheme,
 * but NOT a dump of the entire eligibility document.
 *
 * We include:
 *   - Title (repeated 2x for emphasis)
 *   - Description
 *   - Benefits
 *   - Short Eligibility Summary (first 200 chars, cleaned)
 *   - Tags
 *   - Category
 *   - State (normalised to match query normalisation)
 *
 * All fields are taken from structured database columns.
 * No text inference, no regex, no keyword extraction.
 */
export const buildSearchText = (scheme) => {
  // If a precomputed searchText exists and is substantial, use it
  if (scheme.searchText && scheme.searchText.trim().length > 50) {
    return scheme.searchText.trim();
  }

  // Otherwise, build from available fields
  const name = scheme.name || "";
  const description = scheme.description || "";
  const benefits = scheme.benefits || "";
  let eligibility = scheme.eligibility || "";

  // Truncate eligibility to a short summary (200 chars) to avoid diluting signal
  if (eligibility.length > 200) {
    eligibility = eligibility.substring(0, 200).trim();
    // Try to cut at last complete sentence/word
    const lastSpace = eligibility.lastIndexOf(" ");
    if (lastSpace > 100) {
      eligibility = eligibility.substring(0, lastSpace);
    }
    eligibility += "...";
  }

  const tags = (scheme.tags || []).join(" ");
  const category = scheme.category || "";
  const state = scheme.state || "";

  // Normalise state exactly the same way as in groqService.js
  const normalisedState = String(state).toLowerCase().replace(/[^a-z0-9]/g, "");

  // Repeat name for stronger signal (but not excessively)
  const nameRepeated = [name, name].filter(Boolean).join(" ");

  // Build a concise, keyword‑rich string
  const parts = [
    nameRepeated,
    description,
    benefits,
    eligibility,
    `tags: ${tags}`,
    `category: ${category}`,
    `state: ${normalisedState}`,
  ];

  let result = parts.filter(Boolean).join(" ").toLowerCase();

  // Collapse whitespace
  result = result.replace(/\s+/g, " ").trim();

  // Ultimate safety: never return empty
  if (!result) {
    result = "scheme for citizen welfare";
  }

  return result;
};