import { extractUserProfile, normalizeState, expandQueryForEmbedding } from "../groqService.js";
import {
  applyKeywordFallback,
  hasOccupationEvidence,
  EDUCATION_LEVEL_PATTERNS,
  isThirdPartyRequest,
  extractBeneficiaryProfile,
} from "../keywordFallback.js";
import { getExtractor } from "../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../scoringEngine.js";
import { safeArray, safeString, normalizeSpaces } from "./utils.js";
import { SCORE } from "./constants/scoreConstants.js";
import { buildSchemeFilters } from "../../../services/filterBuilder.js";
import { embeddingCache } from "../../../utils/cache.js";
import { logger } from "../../../utils/logger.js";

const MAX_DB_CANDIDATES = 2000;
const MAX_RESULTS = 40;

const DEFAULT_MAX_PER_CATEGORY = 6;
const INTENT_MAX_PER_CATEGORY = {
  scholarship: 8,
  farmer: 8,
  treatment: 6,
  loan: 5,
  "startup-funding": 5,
};

const buildQueryText = (message, profile, expandedQuery = null) => {
  if (expandedQuery && expandedQuery.trim()) {
    return expandedQuery.trim();
  }

  const parts = [
    message || "",
    `occupation: ${profile.occupation || "unknown"}`,
    `state: ${profile.state || "unknown"}`,
    `gender: ${profile.gender || "unknown"}`,
    `education: ${profile.educationLevel || "unknown"}`,
    `caste: ${profile.casteCategory || "unknown"}`,
    `intent: ${profile.primaryIntent || "unknown"}`,
    `income: ${profile.income ?? "not mentioned"}`,
    `age: ${profile.age ?? "not mentioned"}`,
  ];

  const result = parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ").trim();

  return result || "government scheme citizen welfare assistance";
};

const getQueryEmbedding = async (queryText) => {
  if (!queryText || queryText.trim() === "") {
    queryText = "government scheme citizen welfare assistance";
  }

  // 🆕 Cache embeddings by normalized query text. The local transformer
  // (all-MiniLM-L6-v2) is CPU-bound and re-run on every single request even
  // for near-identical prompts (e.g. multiple users asking "farmer scheme
  // up") — this avoids repeating that work within the TTL window.
  const cacheKey = queryText.toLowerCase().trim();
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    logger.debug("Embedding cache hit");
    return cached;
  }

  const extractor = await getExtractor();
  const output = await extractor(queryText, { pooling: "mean", normalize: true });
  const embedding = Array.from(output.data);
  embeddingCache.set(cacheKey, embedding);
  return embedding;
};

const applyDiversityFilter = (results, primaryIntent) => {
  const maxPerCat = INTENT_MAX_PER_CATEGORY[primaryIntent] ?? DEFAULT_MAX_PER_CATEGORY;
  const categoryCount = {};
  const diverse = [];
  for (const scheme of results) {
    const cat = String(scheme.category || "general").toLowerCase();
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    if (categoryCount[cat] <= maxPerCat) {
      diverse.push(scheme);
    }
    if (diverse.length >= MAX_RESULTS) break;
  }
  return diverse;
};

export const recommendSchemes = async (message) => {
  const trimmedMessage = safeString(message);
  if (!trimmedMessage) return { error: "message is required" };

  const forSomeoneElse = isThirdPartyRequest(trimmedMessage);
  let extractionMessage = trimmedMessage;
  if (forSomeoneElse) {
    extractionMessage = `IMPORTANT: The user is describing the person who needs the scheme, not themselves. Extract the profile of the person who needs the scheme (the beneficiary).\nUser message: "${trimmedMessage}"`;
  }

  let profile = await extractUserProfile(extractionMessage);
  profile = applyKeywordFallback(trimmedMessage, profile);

  let beneficiaryProfile = null;
  if (forSomeoneElse) {
    beneficiaryProfile = extractBeneficiaryProfile(trimmedMessage);
  }

  const expandedQuery = await expandQueryForEmbedding(trimmedMessage, profile);
  const queryText = buildQueryText(trimmedMessage, profile, expandedQuery);
  const queryEmbedding = await getQueryEmbedding(queryText);

  const dbWhere = buildSchemeFilters(profile, { forSomeoneElse });

  const dbCandidates = await prisma.scheme.findMany({
    where: dbWhere,
    select: {
      id: true, name: true, description: true, benefits: true, eligibility: true,
      category: true, ministry: true, state: true, gender: true, occupation: true,
      educationLevel: true, allowedCategories: true, allowedStates: true,
      allowedGenders: true, allowedOccupations: true, allowedEducationLevels: true,
      minIncome: true, maxIncome: true, minAge: true, maxAge: true,
      isScholarship: true, isFemaleOnly: true, schemeFor: true, applicationLink: true,
      sourceUrl: true, tags: true, embedding: true, externalId: true, sourceId: true,
    },
    orderBy: { id: "asc" },
    take: MAX_DB_CANDIDATES,
  });

  const dynamicThreshold =
    SCORE.THRESHOLD_MAP[profile.primaryIntent] ??
    SCORE.THRESHOLD_MAP.default ??
    SCORE.DEFAULT_THRESHOLD;

  const scored = dbCandidates
    .map((scheme) => ({
      ...scheme,
      _score: scoreScheme(scheme, profile, queryEmbedding, trimmedMessage, forSomeoneElse, beneficiaryProfile),
    }))
    .filter((s) => s._score !== null && !Number.isNaN(s._score) && s._score >= dynamicThreshold)
    .sort((a, b) => b._score - a._score);

  const results = scored.map(({ embedding: _e, _score, ...rest }) => ({
    ...rest,
    relevanceScore: Math.round(_score),
  }));

  const diverse = applyDiversityFilter(results, profile.primaryIntent);

  logger.debug("Recommendation summary", {
    primaryIntent: profile.primaryIntent,
    candidatesBeforeScoring: dbCandidates.length,
    candidatesAfterScoring: results.length,
    candidatesAfterDiversity: diverse.length,
  });

  return {
    profile: {
      ...profile,
      _debug: {
        primaryIntent: profile.primaryIntent,
        intentConfidence: profile.intentConfidence,
        queryText,
        expandedQuery,
        candidatesBeforeScoring: dbCandidates.length,
        candidatesAfterScoring: results.length,
        candidatesAfterDiversity: diverse.length,
        threshold: dynamicThreshold,
        forSomeoneElse,
        beneficiaryProfile,
      },
    },
    schemes: diverse,
    meta: { total: diverse.length, candidatesEvaluated: dbCandidates.length },
  };
};