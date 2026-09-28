const SCORE = {
  OCCUPATION_MATCH: 10,
  OCCUPATION_MISMATCH: -5,
  EDUCATION_MATCH: 8,
  RESERVED_CASTE_PENALTY: 15,
  SCHOOL_LEVEL_PENALTY: 10,
};

export const scoreScheme = (scheme, profile) => {
  let hardConflicts = 0;
  let ruleScore = 0;

  const semanticSimilarity = scheme._similarity || 0;

  // ── AGE CHECK ──────────────────────────
  if (profile.age !== null && profile.age !== undefined) {
    if (
      scheme.minAge !== null &&
      scheme.minAge !== undefined &&
      profile.age < scheme.minAge
    ) {
      hardConflicts += 1;
    }

    if (
      scheme.maxAge !== null &&
      scheme.maxAge !== undefined &&
      profile.age > scheme.maxAge
    ) {
      hardConflicts += 1;
    }
  }

  // ── INCOME CHECK ───────────────────────
  if (profile.income !== null && profile.income !== undefined) {
    if (
      scheme.maxIncome !== null &&
      scheme.maxIncome !== undefined &&
      profile.income > scheme.maxIncome
    ) {
      hardConflicts += 1;
    }

    if (
      scheme.minIncome !== null &&
      scheme.minIncome !== undefined &&
      profile.income < scheme.minIncome
    ) {
      hardConflicts += 1;
    }
  }

  // ── RULE-BASED SCORING ─────────────────
  if (hardConflicts === 0) {
    const userCaste = (profile.casteCategory || "")
      .toLowerCase()
      .trim();

    const schemeCategories = (scheme.allowedCategories || [])
      .map((category) => String(category).toLowerCase().trim());

    // ── RESERVED CATEGORY RELEVANCE ──────
    if (
      userCaste === "general" &&
      schemeCategories.length > 0 &&
      !schemeCategories.includes("all") &&
      schemeCategories.some((category) =>
        ["sc", "st", "obc", "minority"].includes(category)
      )
    ) {
      ruleScore -= SCORE.RESERVED_CASTE_PENALTY;
    }

    // ── SCHOOL-LEVEL RELEVANCE ────────────
    if (profile.educationLevel === "higher_education") {
      const schemeEducation = (scheme.allowedEducationLevels || [])
        .map((level) => String(level).toLowerCase().trim());

      const schoolLevels = [
        "10th",
        "12th",
        "iti",
        "below 10th",
      ];

      if (
        schemeEducation.length > 0 &&
        !schemeEducation.includes("all") &&
        schemeEducation.some((level) =>
          schoolLevels.includes(level)
        )
      ) {
        ruleScore -= SCORE.SCHOOL_LEVEL_PENALTY;
      }
    }

    // ── OCCUPATION MATCH ─────────────────
    if (
      profile.occupation &&
      profile.occupation !== "unknown"
    ) {
      const userOccupation = profile.occupation
        .toLowerCase()
        .trim();

      const allowedOccupations = (
        scheme.allowedOccupations || []
      ).map((occupation) =>
        String(occupation).toLowerCase().trim()
      );

      if (
        allowedOccupations.length > 0 &&
        !allowedOccupations.includes("all")
      ) {
        if (allowedOccupations.includes(userOccupation)) {
          ruleScore += SCORE.OCCUPATION_MATCH;
        } else {
          ruleScore += SCORE.OCCUPATION_MISMATCH;
        }
      }
    }

    // ── EDUCATION MATCH ──────────────────
    if (
      profile.educationLevel &&
      profile.educationLevel !== "unknown"
    ) {
      const level = profile.educationLevel
        .toLowerCase()
        .trim();

      let userLevels = [];

      if (level === "higher_education") {
        userLevels = [
          "graduate",
          "post graduate",
          "phd",
          "professional",
          "diploma",
        ];
      } else if (level === "school") {
        userLevels = [
          "10th",
          "12th",
          "iti",
          "below 10th",
        ];
      } else {
        userLevels = [level];
      }

      const schemeEducation = (
        scheme.allowedEducationLevels || []
      ).map((education) =>
        String(education).toLowerCase().trim()
      );

      if (
        schemeEducation.length > 0 &&
        !schemeEducation.includes("all") &&
        userLevels.some((level) =>
          schemeEducation.includes(level)
        )
      ) {
        ruleScore += SCORE.EDUCATION_MATCH;
      }
    }
  }

  // ── FINAL SCORE ────────────────────────
  const embeddingWeight = 0.8;
  const ruleWeight = 0.2;

  const normalizedRuleScore = Math.tanh(ruleScore / 100);

  let finalScore =
    semanticSimilarity * embeddingWeight +
    normalizedRuleScore * ruleWeight;

  if (hardConflicts > 0) {
    finalScore = 0;
  }

  return {
    score: Math.max(0, Math.min(1, finalScore)),
    hardConflicts,
  };
};

