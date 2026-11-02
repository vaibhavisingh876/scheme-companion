import {
  normalizeState,
  HIGHER_EDUCATION_LEVELS,
  SCHOOL_EDUCATION_LEVELS,
} from "../utils/helpers.js";

const getEducationValues = (level) => {
  if (!level || level === "unknown") {
    return [];
  }

  const normalizedLevel = level.toLowerCase().trim();

  if (normalizedLevel === "higher_education") {
    return HIGHER_EDUCATION_LEVELS;
  }

  if (normalizedLevel === "school") {
    return SCHOOL_EDUCATION_LEVELS;
  }

  return [normalizedLevel];
};

const normalizeValue = (value) => {
  return String(value || "")
    .toLowerCase()
    .trim();
};

export const buildSchemeFilters = (profile, options = {}) => {
  const conditions = [
    {
      isActive: true,
    },
  ];

  // ── INCOME ─────────────────────────────
  const income = Number(profile.income);
  if (profile.income !== null && profile.income !== undefined && profile.income !== "" && Number.isFinite(income) && income >= 0) {
    conditions.push({
      OR: [
        { minIncome: null },
        { minIncome: { lte: income } },
      ],
    });
    conditions.push({
      OR: [
        { maxIncome: null },
        { maxIncome: { gte: income } },
      ],
    });
  }

  // ── STATE ──────────────────────────────
  if (profile.state && profile.state !== "unknown") {
    const userState = normalizeState(profile.state);

    if (userState) {
      conditions.push({
        OR: [
          {
            allowedStates: {
              has: "all",
            },
          },
          {
            allowedStates: {
              has: userState,
            },
          },
          {
            allowedStates: {
              isEmpty: true,
            },
          },
        ],
      });
    }
  }

  // ── GENDER ─────────────────────────────
  if (profile.gender && profile.gender !== "unknown") {
    const userGender = normalizeValue(profile.gender);

    if (userGender) {
      conditions.push({
        OR: [
          {
            allowedGenders: {
              has: "all",
            },
          },
          {
            allowedGenders: {
              has: userGender,
            },
          },
          {
            allowedGenders: {
              isEmpty: true,
            },
          },
        ],
      });
    }
  }

  // ── EDUCATION ──────────────────────────
  if (
    profile.educationLevel &&
    profile.educationLevel !== "unknown"
  ) {
    const educationValues = getEducationValues(
      profile.educationLevel
    );

    if (educationValues.length > 0) {
      conditions.push({
        OR: [
          {
            allowedEducationLevels: {
              hasSome: educationValues,
            },
          },
          {
            allowedEducationLevels: {
              has: "all",
            },
          },
          {
            allowedEducationLevels: {
              isEmpty: true,
            },
          },
        ],
      });
    }
  }

  // ── CASTE ──────────────────────────────
  if (
    profile.casteCategory &&
    profile.casteCategory !== "unknown"
  ) {
    const userCategory = normalizeValue(
      profile.casteCategory
    );

    if (userCategory) {
      conditions.push({
        OR: [
          {
            allowedCategories: {
              has: "general",
            },
          },
          {
            allowedCategories: {
              has: userCategory,
            },
          },
          {
            allowedCategories: {
              has: "all",
            },
          },
          {
            allowedCategories: {
              isEmpty: true,
            },
          },
        ],
      });
    }
  }

  // ── OCCUPATION ─────────────────────────
  if (
    profile.occupation &&
    profile.occupation !== "unknown" &&
    options.strictOccupation
  ) {
    const userOccupation = normalizeValue(
      profile.occupation
    );

    if (userOccupation) {
      conditions.push({
        OR: [
          {
            allowedOccupations: {
              has: userOccupation,
            },
          },
          {
            allowedOccupations: {
              has: "all",
            },
          },
          {
            allowedOccupations: {
              isEmpty: true,
            },
          },
        ],
      });
    }
  }

  return {
    AND: conditions,
  };
};
