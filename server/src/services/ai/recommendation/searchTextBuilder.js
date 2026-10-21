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

  // 1. Translated scheme vocabulary is the primary retrieval anchor
  if (profile.searchQuery && profile.searchQuery.trim()) {
    parts.push(`scheme search query: ${profile.searchQuery.trim()}`);
  }

  // 2. Beneficiary primary intent
  if (
    profile.primaryIntent &&
    profile.primaryIntent !== "unknown"
  ) {
    parts.push(
      `intent: ${profile.primaryIntent.replace(/-/g, " ")}`
    );
  }

  // 3. Beneficiary demographic & eligibility attributes
  if (
    profile.occupation &&
    profile.occupation !== "unknown"
  ) {
    parts.push(`occupation: ${profile.occupation}`);
  }

  if (
    profile.gender &&
    profile.gender !== "unknown"
  ) {
    parts.push(`gender: ${profile.gender}`);
  }

  if (
    profile.state &&
    profile.state !== "unknown"
  ) {
    parts.push(`state: ${profile.state}`);
  }

  if (
    profile.casteCategory &&
    profile.casteCategory !== "unknown"
  ) {
    parts.push(
      `caste: ${profile.casteCategory}`
    );
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

  // 4. Raw user message context
  if (rawMessage && rawMessage.trim()) {
    parts.push(`original query: ${rawMessage.trim()}`);
  }

  return (
    cleanText(parts.join(" | ")) ||
    "government scheme citizen welfare"
  );
};
