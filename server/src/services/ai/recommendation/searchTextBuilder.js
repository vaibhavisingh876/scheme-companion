export const buildSearchText = (scheme) => {
  // If a precomputed searchText exists and is substantial, use it
  if (scheme.searchText && scheme.searchText.trim().length > 50) {
    return scheme.searchText.trim();
  }

  // Otherwise, build from available fields
  const name = scheme.name || "";
  const desc = scheme.description || "";
  const benefits = scheme.benefits || "";
  const eligibility = scheme.eligibility || "";
  const tags = (scheme.tags || []).join(" ");

  // Repeat name for stronger signal
  const nameRepeat = [name, name, name].filter(Boolean).join(" ");

  const result = [
    nameRepeat,
    desc,
    benefits,
    eligibility,
    `tags: ${tags}`,
    `category: ${scheme.category || ""}`,
    `ministry: ${scheme.ministry || ""}`,
  ].join(" ").toLowerCase().replace(/\s+/g, " ").trim();

  // Ultimate safety: never return empty
  return result || "scheme for citizen welfare";
};