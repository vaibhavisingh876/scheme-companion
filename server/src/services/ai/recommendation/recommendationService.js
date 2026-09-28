import { getExtractor } from "../../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../scoringEngine.js";
import { embeddingCache } from "../../../utils/cache.js";
import { buildQueryText } from "./searchTextBuilder.js";
import { extractUserProfile } from "../groqService.js";

const MAX_RESULTS = 20;

const cosineSimilarity = (a, b) => {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

const getQueryEmbedding = async (queryText) => {
  const cached = embeddingCache.get(queryText);
  if (cached) return cached;

  const extractor = await getExtractor();
  const output = await extractor(queryText, {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data);
  embeddingCache.set(queryText, embedding);
  return embedding;
};

const deduplicateSchemes = (schemes) => {
  const seen = new Set();
  return schemes.filter((s) => {
    const key =
      s.externalId?.trim() ||
      s.name?.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Deterministic Hard Eligibility Filter
 * Checks if applicant violates any non-negotiable legal/scheme constraints.
 */
export const checkHardEligibility = (scheme, profile) => {
  const conflicts = [];

  // 1. AGE CONFLICT
  if (profile.age !== null && profile.age !== undefined) {
    if (
      scheme.minAge !== null &&
      scheme.minAge !== undefined &&
      profile.age < scheme.minAge
    ) {
      conflicts.push("age_below_minimum");
    }
    if (
      scheme.maxAge !== null &&
      scheme.maxAge !== undefined &&
      profile.age > scheme.maxAge
    ) {
      conflicts.push("age_above_maximum");
    }
  }

  // 2. INCOME CONFLICT
  if (profile.income !== null && profile.income !== undefined) {
    if (
      scheme.maxIncome !== null &&
      scheme.maxIncome !== undefined &&
      profile.income > scheme.maxIncome
    ) {
      conflicts.push("income_above_maximum");
    }
    if (
      scheme.minIncome !== null &&
      scheme.minIncome !== undefined &&
      profile.income < scheme.minIncome
    ) {
      conflicts.push("income_below_minimum");
    }
  }

  // 3. GENDER CONFLICT
  if (profile.gender && profile.gender !== "unknown") {
    const userGender = profile.gender.toLowerCase().trim();
    const allowedGenders = (scheme.allowedGenders || []).map((g) =>
      String(g).toLowerCase().trim()
    );

    if (userGender === "male") {
      if (
        scheme.isFemaleOnly ||
        (allowedGenders.length > 0 &&
          !allowedGenders.includes("all") &&
          allowedGenders.includes("female") &&
          !allowedGenders.includes("male"))
      ) {
        conflicts.push("female_only_scheme");
      }
    } else if (userGender === "female") {
      if (
        allowedGenders.length > 0 &&
        !allowedGenders.includes("all") &&
        allowedGenders.includes("male") &&
        !allowedGenders.includes("female")
      ) {
        conflicts.push("male_only_scheme");
      }
    }
  }

  // 4. CASTE / CATEGORY CONFLICT
  if (profile.casteCategory && profile.casteCategory !== "unknown") {
    const userCategory = profile.casteCategory.toLowerCase().trim();
    const allowedCats = (scheme.allowedCategories || []).map((c) =>
      String(c).toLowerCase().trim()
    );

    if (allowedCats.length > 0 && !allowedCats.includes("all")) {
      if (userCategory === "general") {
        if (
          allowedCats.some((c) => ["sc", "st", "obc", "minority"].includes(c)) &&
          !allowedCats.includes("general")
        ) {
          conflicts.push("reserved_category_only");
        }
      } else {
        if (
          !allowedCats.includes(userCategory) &&
          !allowedCats.includes("general")
        ) {
          conflicts.push("category_mismatch");
        }
      }
    }
  }

  // 5. STATE CONFLICT
  if (profile.state && profile.state !== "unknown") {
    const userState = profile.state
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
    const allowedStates = (scheme.allowedStates || []).map((s) =>
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim()
    );

    if (
      allowedStates.length > 0 &&
      !allowedStates.includes("all") &&
      !allowedStates.includes("allindia")
    ) {
      if (!allowedStates.includes(userState)) {
        conflicts.push("state_mismatch");
      }
    }
  }

  return {
    isEligible: conflicts.length === 0,
    conflicts,
  };
};

/**
 * Main recommendation pipeline:
 * User query -> User query embedding -> Dual cosine similarities (description + eligibility)
 * -> Hard eligibility filter gate -> Scoring -> Deduplication -> Top recommendations (NO diversification)
 */
export const recommendSchemes = async (message) => {
  const trimmed = (message || "").trim();
  if (!trimmed) return { error: "message is required" };

  // 1. Extract structured profile from user conversation
  const profile = await extractUserProfile(trimmed);

  // 2. Build semantic query text and generate query embedding
  const queryText = buildQueryText(profile, trimmed);
  const queryEmbedding = await getQueryEmbedding(queryText);

  // 3. Retrieve all active schemes from DB
  const candidateSchemes = await prisma.scheme.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      benefits: true,
      eligibility: true,
      category: true,
      ministry: true,
      state: true,
      allowedCategories: true,
      allowedStates: true,
      allowedGenders: true,
      allowedOccupations: true,
      allowedEducationLevels: true,
      minIncome: true,
      maxIncome: true,
      minAge: true,
      maxAge: true,
      isFemaleOnly: true,
      isScholarship: true,
      schemeFor: true,
      applicationLink: true,
      sourceUrl: true,
      tags: true,
      externalId: true,
      descriptionEmbedding: true,
      eligibilityEmbedding: true,
    },
  });

  if (!candidateSchemes.length) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: { total: 0, candidatesEvaluated: 0 },
    };
  }

  // 4. Compute dual semantic similarities & evaluate hard eligibility
  const evaluated = candidateSchemes.map((scheme) => {
    const hasDescEmb = Array.isArray(scheme.descriptionEmbedding) && scheme.descriptionEmbedding.length > 0;
    const hasEligEmb = Array.isArray(scheme.eligibilityEmbedding) && scheme.eligibilityEmbedding.length > 0;

    const descSim = hasDescEmb
      ? cosineSimilarity(queryEmbedding, scheme.descriptionEmbedding)
      : 0;

    const eligSim = hasEligEmb
      ? cosineSimilarity(queryEmbedding, scheme.eligibilityEmbedding)
      : 0;

    // Dual semantic similarity:
    // Description embedding captures domain/intent/benefits.
    // Full raw eligibility embedding captures citizen persona/detailed qualifications.
    let semanticSimilarity = 0;
    if (hasDescEmb && hasEligEmb) {
      semanticSimilarity = 0.5 * descSim + 0.5 * eligSim;
    } else if (hasDescEmb) {
      semanticSimilarity = descSim;
    } else if (hasEligEmb) {
      semanticSimilarity = eligSim;
    }

    // Deterministic hard eligibility check
    const { isEligible, conflicts } = checkHardEligibility(scheme, profile);

    // Rule-based soft score adjustments (occupation/education alignment)
    const { score } = scoreScheme(
      {
        ...scheme,
        _similarity: semanticSimilarity,
        _semanticSimilarity: semanticSimilarity,
      },
      profile
    );

    return {
      ...scheme,
      _descSim: descSim,
      _eligSim: eligSim,
      _semanticSimilarity: semanticSimilarity,
      _isEligible: isEligible,
      _hardConflicts: conflicts.length,
      _conflictReasons: conflicts,
      _score: isEligible ? score : 0,
    };
  });

  // 5. Hard Filter Gate: strictly eliminate schemes with hard eligibility conflicts
  const eligibleSchemes = evaluated.filter((s) => s._isEligible && s._score > 0);

  // 6. Relevance Threshold filtering
  const passingThreshold = eligibleSchemes.filter((s) => s._score >= 0.25);
  const poolToRank = passingThreshold.length > 0 ? passingThreshold : eligibleSchemes;

  // 7. Sort by composite score descending
  poolToRank.sort((a, b) => b._score - a._score);

  // 8. Deduplicate identical schemes
  const deduped = deduplicateSchemes(poolToRank);

  // 9. Take top results (NO DIVERSIFICATION)
  const topResults = deduped.slice(0, MAX_RESULTS);

  // 10. Format final output for client
  const results = topResults.map(
    ({
      descriptionEmbedding,
      eligibilityEmbedding,
      _descSim,
      _eligSim,
      _semanticSimilarity,
      _isEligible,
      _hardConflicts,
      _conflictReasons,
      _score,
      ...rest
    }) => ({
      ...rest,
      relevanceScore: Math.round(_score * 100),
    })
  );

  return {
    profile: { ...profile },
    schemes: results,
    meta: {
      total: results.length,
      candidatesEvaluated: candidateSchemes.length,
    },
  };
};