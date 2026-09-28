const cleanText = (value) => {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Builds the query text used for the user's semantic embedding.
 */
export const buildQueryText = (profile, rawMessage = "") => {
  const parts = [];

  if (profile.occupation && profile.occupation !== "unknown") {
    parts.push(`occupation: ${profile.occupation}`);
  }

  if (profile.state && profile.state !== "unknown") {
    parts.push(`state: ${profile.state}`);
  }

  if (
    profile.educationLevel &&
    profile.educationLevel !== "unknown"
  ) {
    const education =
      profile.educationLevel === "higher_education"
        ? "higher education"
        : "school level";

    parts.push(`education: ${education}`);
  }

  if (
    profile.primaryIntent &&
    profile.primaryIntent !== "unknown"
  ) {
    parts.push(
      `intent: ${profile.primaryIntent.replace(/-/g, " ")}`
    );
  }

  if (profile.gender && profile.gender !== "unknown") {
    parts.push(`gender: ${profile.gender}`);
  }

  if (
    profile.income !== null &&
    profile.income !== undefined
  ) {
    parts.push(`income: ${profile.income}`);
  }

  if (
    profile.age !== null &&
    profile.age !== undefined
  ) {
    parts.push(`age: ${profile.age}`);
  }

  if (
    profile.casteCategory &&
    profile.casteCategory !== "unknown"
  ) {
    parts.push(
      `caste: ${profile.casteCategory}`
    );
  }

  if (rawMessage && rawMessage.trim()) {
    parts.push(`query: ${rawMessage}`);
  }

  return (
    cleanText(parts.join(" | ")) ||
    "government scheme citizen welfare"
  );
};

/**
 * Builds a combined representation of a scheme.
 * Used only for the legacy/general embedding.
 */
export const buildSearchText = (scheme) => {
  const parts = [
    `name: ${scheme.name || ""}`,
    `description: ${scheme.description || ""}`,
    `benefits: ${scheme.benefits || ""}`,
    `eligibility: ${scheme.eligibility || ""}`,
    `tags: ${(scheme.tags || []).join(" ")}`,
    `category: ${scheme.category || ""}`,
    `ministry: ${scheme.ministry || ""}`,
    `scheme for: ${scheme.schemeFor || ""}`,
    `occupations: ${(scheme.allowedOccupations || []).join(" ")}`,
    `states: ${(scheme.allowedStates || []).join(" ")}`,
    `education: ${(scheme.allowedEducationLevels || []).join(" ")}`,
    `categories: ${(scheme.allowedCategories || []).join(" ")}`,
    `genders: ${(scheme.allowedGenders || []).join(" ")}`,
    `minimum age: ${scheme.minAge ?? ""}`,
    `maximum age: ${scheme.maxAge ?? ""}`,
    `minimum income: ${scheme.minIncome ?? ""}`,
    `maximum income: ${scheme.maxIncome ?? ""}`,
    `scholarship: ${scheme.isScholarship ? "yes" : "no"}`,
    `female only: ${scheme.isFemaleOnly ? "yes" : "no"}`,
  ];

  return (
    cleanText(parts.join(" | ")) ||
    "scheme for citizen welfare"
  );
};