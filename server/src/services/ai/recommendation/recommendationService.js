// recommendationService.js
import { extractUserProfile } from "../groqService.js";
import { getExtractor } from "../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../scoringEngine.js";
import { buildSchemeFilters } from "../../../services/filterBuilder.js";
import { embeddingCache } from "../../../utils/cache.js";
import { logger } from "../../../utils/logger.js";
import { INTENT_CATEGORY_MAP, INTENT_TAG_MAP } from "./constants/scoreConstants.js";

const DEBUG = process.env.DEBUG === 'true';
const MAX_RESULTS = 20;
const FAST_CANDIDATES = 300;

// ---- Synonym map ----
const SYNONYM_MAP = {
  occupation: {
    farmer: "farmer agriculture farming crop cultivation krishak kisan",
    student: "student education scholar pupil",
    worker: "worker labour labor shramik",
    startup: "startup business entrepreneur udyami",
    housewife: "housewife homemaker grihini",
    unemployed: "unemployed jobless berozgaar",
    widow: "widow vidhwa bereaved",
  },
  primaryIntent: {
    farmer: "farmer agriculture farming crop cultivation",
    scholarship: "scholarship student education tuition fee",
    treatment: "treatment medical health hospital",
    "widow-support": "widow support vidhwa sahara",
    maternity: "maternity pregnancy delivery",
    disability: "disability divyang handicapped",
    loan: "loan credit finance mudra",
    "startup-funding": "startup business funding",
    business: "business enterprise",
    job: "job employment rojgaar skill",
    unemployed: "unemployed jobless employment",
    housing: "housing shelter awas",
    sanitation: "sanitation toilet swachh",
    pension: "pension senior vridha",
    marriage: "marriage vivah wedding",
    death: "death demise ex-gratia",
  },
};

// ---- Fast metadata score (no embeddings) ----
const fastMetadataScore = (scheme, profile, rawMessage) => {
  let score = 0;
  const text = [
    String(scheme.name || "").toLowerCase(),
    String(scheme.description || "").toLowerCase(),
    String(scheme.eligibility || "").toLowerCase(),
    ...(scheme.tags || []).map(t => String(t).toLowerCase()),
  ].join(" ");

  // Occupation match
  if (profile.occupation && profile.occupation !== "unknown") {
    const occ = profile.occupation.toLowerCase().trim();
    const allowed = (scheme.allowedOccupations || []).map(o => String(o).toLowerCase().trim());
    if (allowed.includes(occ) || allowed.includes("all") || allowed.length === 0) {
      score += 20;
    } else {
      score -= 10;
    }
  }

  // Education match
  if (profile.educationLevel && profile.educationLevel !== "unknown") {
    const edu = profile.educationLevel.toLowerCase().trim();
    const allowed = (scheme.allowedEducationLevels || []).map(e => String(e).toLowerCase().trim());
    if (allowed.includes(edu) || allowed.includes("all") || allowed.length === 0) {
      score += 10;
    } else {
      score -= 5;
    }
  }

  // State – strong penalty for mismatch (-30)
  if (profile.state && profile.state !== "unknown") {
    const normState = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const userState = normState(profile.state);
    const allowedStates = (scheme.allowedStates || []).map(normState);
    const schemeState = normState(scheme.state);
    const isNational = allowedStates.includes("all") || schemeState === "" || schemeState === "all" || schemeState === "india";
    if (!isNational) {
      if (allowedStates.includes(userState) || schemeState === userState) {
        score += 15;
      } else {
        score -= 30;
      }
    }
  }

  // Intent keywords from raw message
  if (rawMessage) {
    const msg = rawMessage.toLowerCase();
    if (/\bloan\b/.test(msg) || /\bcredit\b/.test(msg)) {
      if (/\bloan\b/.test(text) || /\bcredit\b/.test(text)) score += 15;
    }
    if (/\bbusiness\b/.test(msg) || /\bstartup\b/.test(msg) || /\bsmall business\b/.test(msg)) {
      if (/\bbusiness\b/.test(text) || /\bstartup\b/.test(text) || /\bself[-\s]?employment\b/.test(text) || /\bmudra\b/.test(text)) score += 15;
    }
    if (/\bjob\b/.test(msg) || /\bemployment\b/.test(msg)) {
      if (/\bjob\b/.test(text) || /\bemployment\b/.test(text) || /\brojgaar\b/.test(text)) score += 10;
    }
  }

  return score;
};

// ---- Query builder ----
const buildQueryText = (message, profile) => {
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
  const occ = profile.occupation;
  if (occ && occ !== "unknown" && SYNONYM_MAP.occupation[occ]) parts.push(SYNONYM_MAP.occupation[occ]);
  const intent = profile.primaryIntent;
  if (intent && intent !== "unknown" && SYNONYM_MAP.primaryIntent[intent]) parts.push(SYNONYM_MAP.primaryIntent[intent]);

  const msg = message.toLowerCase();
  if (/\bloan\b/.test(msg) || /\bcredit\b/.test(msg)) parts.push("loan credit financial assistance");
  if (/\bbusiness\b/.test(msg) || /\bstartup\b/.test(msg) || /\bsmall business\b/.test(msg)) parts.push("business startup self-employment mudra");
  if (/\bjob\b/.test(msg) || /\bemployment\b/.test(msg) || /\bwork\b/.test(msg)) parts.push("job employment rojgaar skill");

  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim() || "government scheme citizen welfare assistance";
};

// ---- Embedding ----
const getQueryEmbedding = async (queryText) => {
  const cacheKey = queryText.toLowerCase().trim();
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;
  const extractor = await getExtractor();
  const output = await extractor(queryText, { pooling: "mean", normalize: true });
  const embedding = Array.from(output.data);
  embeddingCache.set(cacheKey, embedding);
  return embedding;
};

// ---- Category normalization ----
const normalizeCategory = (cat) => {
  if (!cat) return "other";
  const c = String(cat).toLowerCase().trim();
  if (/agriculture|farming|farmer|crop|kisan|krishak/.test(c)) return "agriculture";
  if (/education|scholarship|student|tuition|fee|learning/.test(c)) return "education";
  if (/health|medical|treatment|hospital|wellness/.test(c)) return "health";
  if (/housing|shelter|awas|pmay/.test(c)) return "housing";
  if (/social|welfare|empowerment|women|child|pension|widow/.test(c)) return "social";
  if (/skill|employment|job|rojgaar/.test(c)) return "employment";
  if (/business|startup|entrepreneur|udyami/.test(c)) return "business";
  if (/banking|financial|loan|credit/.test(c)) return "finance";
  if (/sanitation|toilet|swachh/.test(c)) return "sanitation";
  return "other";
};

// ---- Deduplication ----
const deduplicateSchemes = (schemes) => {
  const seen = new Set();
  const result = [];
  for (const scheme of schemes) {
    let key = scheme.externalId ? String(scheme.externalId).trim() : String(scheme.name).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(key)) { seen.add(key); result.push(scheme); }
  }
  return result;
};

// ---- Intent‑aware diversity ----
const getIntentCategory = (primaryIntent) => {
  const intentCats = INTENT_CATEGORY_MAP[primaryIntent] || [];
  if (intentCats.length > 0) {
    const normalizedIntentCats = intentCats.map(c => normalizeCategory(c));
    const found = normalizedIntentCats.find(c => c !== "other");
    return found || "other";
  }
  return "other";
};

const applyDiversity = (sortedScored, maxResults, primaryIntent) => {
  if (sortedScored.length === 0) return [];
  const intentCategory = getIntentCategory(primaryIntent);
  const categoryCounts = {};
  for (const s of sortedScored) {
    const norm = normalizeCategory(s.category);
    categoryCounts[norm] = (categoryCounts[norm] || 0) + 1;
  }
  const numCategories = Object.keys(categoryCounts).length;
  let baseCap = Math.max(4, Math.ceil(maxResults / Math.min(numCategories, 4)));
  baseCap = Math.min(10, Math.max(4, baseCap));
  const intentCap = Math.max(12, baseCap * 2);
  const result = [], used = {};
  for (const scheme of sortedScored) {
    const norm = normalizeCategory(scheme.category);
    const cap = (norm === intentCategory) ? intentCap : baseCap;
    if ((used[norm] || 0) < cap) {
      result.push(scheme);
      used[norm] = (used[norm] || 0) + 1;
      if (result.length >= maxResults) break;
    }
  }
  if (result.length < maxResults) {
    for (const scheme of sortedScored) {
      if (!result.includes(scheme)) {
        result.push(scheme);
        const norm = normalizeCategory(scheme.category);
        used[norm] = (used[norm] || 0) + 1;
        if (result.length >= maxResults) break;
      }
    }
  }
  return result;
};

// ---- Dynamic threshold ----
const computeThreshold = (scored) => {
  if (!scored || scored.length === 0) return 40;
  const topScore = scored[0]?._score || 0;
  return Math.max(40, topScore * 0.55);
};

// ---- Main recommendation function ----
export const recommendSchemes = async (message) => {
  const trimmedMessage = (message || "").trim();
  if (!trimmedMessage) return { error: "message is required" };

  const profile = await extractUserProfile(trimmedMessage);
  const queryText = buildQueryText(trimmedMessage, profile);
  const queryEmbedding = await getQueryEmbedding(queryText);
  const dbWhere = buildSchemeFilters(profile);

  // Stage 1: Fetch all candidates with hard filters (no state filter)
  const allCandidates = await prisma.scheme.findMany({
    where: dbWhere,
    select: {
      id: true, name: true, description: true, benefits: true, eligibility: true,
      category: true, ministry: true, state: true, gender: true, occupation: true,
      educationLevel: true, allowedCategories: true, allowedStates: true,
      allowedGenders: true, allowedOccupations: true, allowedEducationLevels: true,
      minIncome: true, maxIncome: true, minAge: true, maxAge: true,
      isScholarship: true, isFemaleOnly: true, schemeFor: true,
      applicationLink: true, sourceUrl: true, tags: true, embedding: true,
      externalId: true, sourceId: true,
    },
    orderBy: { id: "asc" },
  });

  // Stage 2: Compute fast metadata score for each scheme and sort
  const withFastScore = allCandidates.map(scheme => ({
    ...scheme,
    _fastScore: fastMetadataScore(scheme, profile, trimmedMessage),
  }));
  withFastScore.sort((a, b) => b._fastScore - a._fastScore);

  // Take top FAST_CANDIDATES for full scoring
  const topFast = withFastScore.slice(0, FAST_CANDIDATES);

  // Stage 3: Full scoring (embedding + detailed metadata) on topFast
  const scored = topFast
    .map((scheme) => {
      const { score, reasons, hardConflicts } = scoreScheme(scheme, profile, queryEmbedding, trimmedMessage);
      return { ...scheme, _score: score, _reasons: reasons, _hardConflicts: hardConflicts };
    })
    .filter((s) => s._score !== null && !Number.isNaN(s._score));

  scored.sort((a, b) => b._score - a._score);
  const deduped = deduplicateSchemes(scored);

  // Only schemes with zero hard eligibility conflicts are real candidates.
  // (Schemes that failed a hard check are forced to score 0 by scoreScheme,
  // and must never be surfaced by the "nothing passed threshold" fallback below.)
  const eligible = deduped.filter((s) => s._hardConflicts === 0);

  const threshold = computeThreshold(eligible);
  const aboveThreshold = eligible.filter((s) => s._score >= threshold);
  const rejectedByThreshold = eligible.length - aboveThreshold.length;
  let finalCandidates = aboveThreshold.length === 0 ? eligible.slice(0, 5) : aboveThreshold;
  const diverse = applyDiversity(finalCandidates, MAX_RESULTS, profile.primaryIntent);

  const results = diverse.map(({ embedding: _e, _score, _reasons, _hardConflicts, ...rest }) => ({
    ...rest,
    relevanceScore: Math.round(_score),
    ...(DEBUG ? { _debugReasons: _reasons, _hardConflicts } : {}),
  }));

  const topScore = eligible.length ? eligible[0]._score : 0;
  const avgScore = eligible.length ? eligible.reduce((s, a) => s + a._score, 0) / eligible.length : 0;
  const safeFilters = JSON.stringify(dbWhere, (key, value) => {
    if (key === "embedding") return undefined;
    if (key === "AND" && Array.isArray(value) && value.length > 20) return "[...]";
    return value;
  });

  return {
    profile: {
      ...profile,
      _debug: {
        filtersApplied: JSON.parse(safeFilters),
        totalCandidates: allCandidates.length,
        fastCandidates: topFast.length,
        scoredCount: scored.length,
        dedupedCount: deduped.length,
        eligibleCount: eligible.length,
        finalCandidateCount: finalCandidates.length,
        minimumAcceptedScore: Math.round(threshold),
        topScore: Math.round(topScore),
        averageScore: Math.round(avgScore),
        rejectedByThreshold,
        candidatesAfterDiversity: diverse.length,
      },
    },
    schemes: results,
    meta: { total: results.length, candidatesEvaluated: allCandidates.length },
  };
};