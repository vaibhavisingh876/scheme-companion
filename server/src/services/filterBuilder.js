// src/services/filterBuilder.js
import { normalizeState } from "./ai/groqService.js";

export const buildSchemeFilters = (profile, options = {}) => {
  const { forSomeoneElse = false, strictOccupation = false } = options;
  const {
    gender, age, occupation, state, income, casteCategory,
    educationLevel, primaryIntent
  } = profile;

  const andConditions = [{ isActive: true }];

  // 1. GENDER (exclude female-only if user is male)
  if (gender && gender !== "unknown") {
    if (gender === "male") {
      andConditions.push({ isFemaleOnly: false });
    }
    // If female, we let female-only pass (no filter)
  }

  // 2. AGE
  if (age !== null && age !== undefined) {
    andConditions.push({
      OR: [
        { minAge: null },
        { minAge: { lte: age } }
      ]
    });
    andConditions.push({
      OR: [
        { maxAge: null },
        { maxAge: { gte: age } }
      ]
    });
  }

  // 3. OCCUPATION (Skip if forSomeoneElse or no evidence)
  if (occupation && occupation !== "unknown" && occupation !== "all") {
    if (!forSomeoneElse || strictOccupation) {
      andConditions.push({
        OR: [
          { allowedOccupations: { has: occupation } },
          { allowedOccupations: { has: "all" } }
        ]
      });
    }
  }

  // 4. STATE
  if (state && state !== "unknown") {
    const normalized = normalizeState(state);
    andConditions.push({
      OR: [
        { allowedStates: { has: "all" } },
        { allowedStates: { has: normalized } }
      ]
    });
  }

  // 5. INCOME
  if (income !== null && income !== undefined) {
    andConditions.push({
      OR: [{ maxIncome: null }, { maxIncome: { gte: income } }]
    });
    // Min income is less critical, but keeping it safe
    andConditions.push({
      OR: [{ minIncome: null }, { minIncome: { lte: income } }]
    });
  }

  // 6. CASTE
  if (casteCategory && casteCategory !== "unknown" && casteCategory !== "general") {
    // Specific reserved-category user: allow schemes for their category, general, or all.
    andConditions.push({
      OR: [
        { allowedCategories: { has: casteCategory } },
        { allowedCategories: { has: "general" } },
        { allowedCategories: { has: "all" } }
      ]
    });
  } else if (casteCategory === "general") {
    // 🆕 DEFENSE IN DEPTH: previously general users had NO hard filter here at
    // all and relied entirely on scoringEngine's text-based reject — which
    // was silently broken (see scoringEngine.js comments). Now, at the DB
    // query level itself, general-category users never even fetch a scheme
    // that has declared a restricted allowedCategories list not including
    // "general"/"all". Schemes with an *empty* allowedCategories array are
    // treated as unrestricted and still pass through (the scoring-layer
    // text/name reject in scoringEngine.js is the safety net for those).
    andConditions.push({
      OR: [
        { allowedCategories: { isEmpty: true } },
        { allowedCategories: { has: "general" } },
        { allowedCategories: { has: "all" } }
      ]
    });
  }

  // 7. EDUCATION
  // NOTE: this is intentionally strict — a scheme with an empty
  // allowedEducationLevels array is EXCLUDED once the user has a known
  // education level, not treated as "unrestricted". That's what makes
  // "higher-ed users never see school-level schemes" hold even for schemes
  // whose ingestion pipeline never populated this array. The tradeoff is
  // that some genuinely unrestricted schemes with an empty array will be
  // hidden too — safer default, but worth knowing about (see write-up).
  if (educationLevel && educationLevel !== "unknown") {
    andConditions.push({
      OR: [
        { allowedEducationLevels: { has: educationLevel } },
        { allowedEducationLevels: { has: "all" } }
      ]
    });
  }

  // 8. INTENT (Scholarship flag boost)
  if (primaryIntent === "scholarship") {
    andConditions.push({ isScholarship: true });
  }

  // Remove empty AND
  if (andConditions.length === 0) return {};
  if (andConditions.length === 1 && andConditions[0].isActive) return { isActive: true };

  return { AND: andConditions };
};