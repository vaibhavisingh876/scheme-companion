import {
  HIGHER_EDUCATION_LEVELS,
  SCHOOL_EDUCATION_LEVELS,
} from "../../utils/helpers.js";
import { columnsToRules, checkRules } from "./recommendation/verification.js";

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

  const semanticSimilarity =
    scheme._similarity ?? scheme._semanticSimilarity ?? 0;

  // ── AGE & INCOME HARD CHECK ──────────────────────────
  const rules = columnsToRules(scheme);
  if (rules) {
    const verified = checkRules(rules, profile);
    const hardChecks = verified.checks.filter(
      (c) => (c.field === "age" || c.field === "income") && c.result === "no_match"
    );
    hardConflicts += hardChecks.length;
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

      const schoolLevels = SCHOOL_EDUCATION_LEVELS;

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
        userLevels = HIGHER_EDUCATION_LEVELS;
      } else if (level === "school") {
        userLevels = SCHOOL_EDUCATION_LEVELS;
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

