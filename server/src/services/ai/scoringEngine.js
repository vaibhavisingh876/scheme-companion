const SCORE = {
  OCCUPATION_MATCH: 10,
  OCCUPATION_MISMATCH: -5,
  EDUCATION_MATCH: 8,
  RESERVED_CASTE_PENALTY: 15,
  SCHOOL_LEVEL_PENALTY: 10,
};

export const scoreScheme = (scheme, profile, rawMessage) => {
  let hardConflicts = 0;
  let ruleScore = 0;
  const similarity = scheme._similarity || 0;

  // ── AGE CHECK ──────────────────────────
  if (profile.age !== null && profile.age !== undefined) {
    if (scheme.minAge !== null && profile.age < scheme.minAge) hardConflicts += 1;
    if (scheme.maxAge !== null && profile.age > scheme.maxAge) hardConflicts += 1;
  }

  // ── INCOME CHECK ───────────────────────
  if (profile.income !== null && profile.income !== undefined) {
    if (scheme.maxIncome !== null && profile.income > scheme.maxIncome) hardConflicts += 1;
    if (scheme.minIncome !== null && profile.income < scheme.minIncome) hardConflicts += 1;
  }

  // ── GENDER CHECK ───────────────────────
  const userGender = (profile.gender || "").toLowerCase().trim();
  const allowedGenders = (scheme.allowedGenders || []).map(g => String(g).toLowerCase().trim());
  if (scheme.isFemaleOnly === true && userGender !== "female") {
    hardConflicts += 1;
  }
  if (
    allowedGenders.length > 0 &&
    !allowedGenders.includes("all") &&
    userGender &&
    userGender !== "unknown" &&
    !allowedGenders.includes(userGender)
  ) {
    hardConflicts += 1;
  }

  // ── EDUCATION CHECK (mapped) ───────────
  if (profile.educationLevel && profile.educationLevel !== "unknown") {
    const level = profile.educationLevel.toLowerCase();
    let userLevels = [];
    if (level === "higher_education") {
      userLevels = ["graduate", "post graduate", "phd", "professional", "diploma"];
    } else if (level === "school") {
      userLevels = ["10th", "12th", "iti", "below 10th"];
    } else {
      userLevels = [level];
    }

    const schemeEdu = (scheme.allowedEducationLevels || []).map(e => String(e).toLowerCase().trim());
    if (schemeEdu.length > 0 && !schemeEdu.includes("all")) {
      if (!userLevels.some(ul => schemeEdu.includes(ul))) {
        hardConflicts += 1;
      }
    }
  }

  // ── CASTE CHECK ────────────────────────
  const userCaste = (profile.casteCategory || "").toLowerCase().trim();
  const effectiveCaste = userCaste === "unknown" || userCaste === "" ? "general" : userCaste;
  const allowedCastes = (scheme.allowedCategories || []).map(c => String(c).toLowerCase().trim());
  if (
    allowedCastes.length > 0 &&
    !allowedCastes.includes("all") &&
    !allowedCastes.includes(effectiveCaste)
  ) {
    hardConflicts += 1;
  }

  // 🆕 ── STATE HARD CONFLICT ─────────────
  if (profile.state && profile.state !== "unknown") {
    const allowedStates = (scheme.allowedStates || []).map(s =>
      String(s).toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    const normUserState = String(profile.state)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const isNational = allowedStates.includes("all") || allowedStates.includes("india");
    if (!isNational && !allowedStates.includes(normUserState)) {
      hardConflicts += 1;
    }
  }

  // ── RULE‑BASED SCORING ────────────────
  if (hardConflicts === 0) {
    const schemeText = [
      String(scheme.name || "").toLowerCase(),
      String(scheme.description || "").toLowerCase(),
      String(scheme.eligibility || "").toLowerCase(),
      ...(scheme.tags || []).map(t => String(t).toLowerCase()),
    ].join(" ");

    if (
      effectiveCaste === "general" &&
      /\b(sc|st|obc|minority|scheduled caste|scheduled tribe|dalit|adivasi)\b/i.test(schemeText)
    ) {
      ruleScore -= SCORE.RESERVED_CASTE_PENALTY;
    }

    if (
      profile.educationLevel === "higher_education" &&
      /\b(school|class|nursery|uniform|textbook|matric)\b/i.test(schemeText)
    ) {
      ruleScore -= SCORE.SCHOOL_LEVEL_PENALTY;
    }

    // Occupation match
    if (profile.occupation && profile.occupation !== "unknown") {
      const userOcc = profile.occupation.toLowerCase().trim();
      const allowedOccs = (scheme.allowedOccupations || []).map(o => String(o).toLowerCase().trim());
      if (allowedOccs.length > 0 && !allowedOccs.includes("all")) {
        if (allowedOccs.includes(userOcc)) {
          ruleScore += SCORE.OCCUPATION_MATCH;
        } else {
          ruleScore += SCORE.OCCUPATION_MISMATCH;
        }
      }
    }

    // Education bonus (exact)
    if (profile.educationLevel && profile.educationLevel !== "unknown") {
      const level = profile.educationLevel.toLowerCase();
      let userLevels = [];
      if (level === "higher_education") {
        userLevels = ["graduate", "post graduate", "phd", "professional", "diploma"];
      } else if (level === "school") {
        userLevels = ["10th", "12th", "iti", "below 10th"];
      } else {
        userLevels = [level];
      }
      const schemeEdu = (scheme.allowedEducationLevels || []).map(e => String(e).toLowerCase().trim());
      if (schemeEdu.length > 0 && !schemeEdu.includes("all")) {
        if (userLevels.some(ul => schemeEdu.includes(ul))) {
          ruleScore += SCORE.EDUCATION_MATCH;
        }
      }
    }
  }

  // ── FINAL SCORE ────────────────────────
  const embeddingWeight = 0.8;
  const ruleWeight = 0.2;
  const normalizedRuleScore = Math.tanh(ruleScore / 100);
  let finalScore = similarity * embeddingWeight + normalizedRuleScore * ruleWeight;

  if (hardConflicts > 0) finalScore = 0;

  return {
    score: Math.max(0, Math.min(1, finalScore)),
    hardConflicts,
  };
};