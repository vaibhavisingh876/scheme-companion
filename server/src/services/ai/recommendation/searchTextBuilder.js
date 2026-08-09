/**
 * Builds the query text for embedding from the user's profile and raw message.
 */
export const buildQueryText = (profile, rawMessage = "") => {
  const parts = [];

  if (profile.occupation && profile.occupation !== "unknown") {
    parts.push(`occupation: ${profile.occupation}`);
  }

  if (profile.state && profile.state !== "unknown") {
    parts.push(`state: ${profile.state}`);
  }

  if (profile.educationLevel && profile.educationLevel !== "unknown") {
    const label = profile.educationLevel === "higher_education" ? "higher education" : "school level";
    parts.push(`education: ${label}`);
  }

  if (profile.primaryIntent && profile.primaryIntent !== "unknown") {
    parts.push(`intent: ${profile.primaryIntent.replace(/-/g, " ")}`);
  }

  if (profile.gender && profile.gender !== "unknown") {
    parts.push(`gender: ${profile.gender}`);
  }

  if (profile.income !== null && profile.income !== undefined) {
    parts.push(`income: ${profile.income}`);
  }

  if (profile.age !== null && profile.age !== undefined) {
    parts.push(`age: ${profile.age}`);
  }

  if (profile.casteCategory && profile.casteCategory !== "unknown") {
    parts.push(`caste: ${profile.casteCategory.toUpperCase()}`);
  }

  if (rawMessage && rawMessage.trim()) {
    parts.push(`query: ${rawMessage.toLowerCase().trim()}`);
  }

  return parts.join(" | ").toLowerCase().replace(/\s+/g, " ").trim() || "government scheme citizen welfare";
};

/**
 * Builds the search text for a scheme to create its embedding.
 * Uses pre-generated searchText if available (length > 50), otherwise builds from fields.
 */
export const buildSearchText = (scheme) => {
  if (scheme.searchText && scheme.searchText.trim().length > 50) {
    return scheme.searchText.trim();
  }

  const name = scheme.name || "";
  const description = scheme.description || "";
  const benefits = (scheme.benefits || "").substring(0, 300);
  let eligibility = (scheme.eligibility || "").substring(0, 300);

  const tags = (scheme.tags || []).join(" ");
  const category = scheme.category || "";
  const ministry = scheme.ministry || "";
  const schemeFor = scheme.schemeFor || "";

  const allowedOccupations = (scheme.allowedOccupations || []).join(" ");
  const allowedStates = (scheme.allowedStates || []).join(" ");
  const allowedEducation = (scheme.allowedEducationLevels || []).join(" ");
  const allowedCategories = (scheme.allowedCategories || []).join(" ");

  const parts = [
    `name: ${name}`,
    `description: ${description}`,
    `benefits: ${benefits}`,
    `eligibility: ${eligibility}`,
    `tags: ${tags}`,
    `category: ${category}`,
    `ministry: ${ministry}`,
    `for: ${schemeFor}`,
    `occupations: ${allowedOccupations}`,
    `states: ${allowedStates}`,
    `education: ${allowedEducation}`,
    `categories: ${allowedCategories}`,
  ];

  return parts.filter(p => p && p.trim()).join(" | ").toLowerCase().replace(/\s+/g, " ").trim() || "scheme for citizen welfare";
};
