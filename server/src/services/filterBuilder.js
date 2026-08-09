// Inline education mapping
const getEducationValues = (level) => {
  if (!level || level === "unknown") return [];
  const l = level.toLowerCase();
  if (l === "higher_education") return ["graduate", "post graduate", "phd", "professional", "diploma"];
  if (l === "school") return ["10th", "12th", "iti", "below 10th"];
  return [l];
};

export const buildSchemeFilters = (profile, options = {}) => {
  const conditions = [];
  conditions.push({ isActive: true });

  // ── STATE ──────────────────────────────
  if (profile.state && profile.state !== "unknown") {
    const userState = profile.state.toLowerCase().replace(/[^a-z0-9]/g, "");
    conditions.push({
      OR: [
        { allowedStates: { has: "all" } },
        { allowedStates: { has: userState } },
        { allowedStates: { isEmpty: true } },
      ],
    });
  }

  // ── GENDER ─────────────────────────────
  if (profile.gender && profile.gender !== "unknown") {
    conditions.push({
      OR: [
        { allowedGenders: { has: "all" } },
        { allowedGenders: { has: profile.gender.toLowerCase() } },
        { allowedGenders: { isEmpty: true } },
      ],
    });
  }

  // ── EDUCATION ─────────────────────────
  if (profile.educationLevel && profile.educationLevel !== "unknown") {
    const eduValues = getEducationValues(profile.educationLevel);
    if (eduValues.length > 0) {
      conditions.push({
        OR: [
          { allowedEducationLevels: { hasSome: eduValues } },
          { allowedEducationLevels: { has: "all" } },
          { allowedEducationLevels: { isEmpty: true } },
        ],
      });
    }
  }

  // ── CASTE ──────────────────────────────
  if (profile.casteCategory && profile.casteCategory !== "unknown") {
    conditions.push({
      OR: [
        { allowedCategories: { has: "all" } },
        { allowedCategories: { has: profile.casteCategory.toLowerCase() } },
        { allowedCategories: { isEmpty: true } },
      ],
    });
  }

  // ── OCCUPATION (ONLY when explicitly asked) ──
  if (profile.occupation && profile.occupation !== "unknown" && options.strictOccupation) {
    conditions.push({
      OR: [
        { allowedOccupations: { has: profile.occupation.toLowerCase() } },
        { allowedOccupations: { has: "all" } },
        { allowedOccupations: { isEmpty: true } },
      ],
    });
  }

  return { AND: conditions };
};