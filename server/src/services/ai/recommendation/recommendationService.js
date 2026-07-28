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

// (Removed: unused/dead INTENT_VOCAB placeholder block — was never referenced
// anywhere in this file and contained only a literal "..." string.)

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

const buildDbWhere = (message, profile, forSomeoneElse = false) => {
  const { gender, income, state, occupation, casteCategory, educationLevel, age, primaryIntent } = profile;
  const dbWhere = { isActive: true, AND: [] };

  if (!forSomeoneElse) {
    if (gender && gender !== "unknown" && gender !== "female") {
      dbWhere.AND.push({ isFemaleOnly: false });
    }
    if (age !== null && age !== undefined) {
      dbWhere.AND.push({ OR: [{ minAge: null }, { minAge: { lte: age } }] });
      dbWhere.AND.push({ OR: [{ maxAge: null }, { maxAge: { gte: age } }] });
    }
    if (occupation && occupation !== "unknown" && occupation !== "all" && hasOccupationEvidence(message, occupation)) {
      dbWhere.AND.push({
        OR: [
          { allowedOccupations: { has: occupation } },
          { allowedOccupations: { has: "all" } },
        ],
      });
    }
    if (casteCategory && casteCategory !== "unknown" && casteCategory !== "general") {
      dbWhere.AND.push({
        OR: [
          { allowedCategories: { has: casteCategory } },
          { allowedCategories: { has: "general" } },
        ],
      });
    }
    const hasEduEvidence = !educationLevel || educationLevel === "unknown" || EDUCATION_LEVEL_PATTERNS.some(({ pattern }) => pattern.test(message));
    if (educationLevel && educationLevel !== "unknown" && hasEduEvidence) {
      dbWhere.AND.push({
        OR: [
          { allowedEducationLevels: { has: educationLevel } },
          { allowedEducationLevels: { has: "all" } },
        ],
      });
    }
    if (primaryIntent === "scholarship") {
      dbWhere.AND.push({ isScholarship: true });
    }
    if (primaryIntent === "farmer" && (occupation === "unknown" || occupation === "all")) {
      dbWhere.AND.push({
        OR: [
          { allowedOccupations: { has: "farmer" } },
          { allowedOccupations: { has: "all" } },
        ],
      });
    }
  }

  if (income !== null && income !== undefined) {
    dbWhere.AND.push({ OR: [{ maxIncome: null }, { maxIncome: { gte: income } }] });
  }
  if (state && state !== "unknown") {
    const normalizedState = normalizeState(state);
    dbWhere.AND.push({
      OR: [
        { allowedStates: { has: "all" } },
        { allowedStates: { has: normalizedState } },
      ],
    });
  }

  if (dbWhere.AND.length === 0) delete dbWhere.AND;
  return dbWhere;
};

const getQueryEmbedding = async (queryText) => {
  if (!queryText || queryText.trim() === "") {
    queryText = "government scheme citizen welfare assistance";
  }
  const extractor = await getExtractor();
  const output = await extractor(queryText, { pooling: "mean", normalize: true });
  return Array.from(output.data);
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

  const dbWhere = buildDbWhere(trimmedMessage, profile, forSomeoneElse);
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