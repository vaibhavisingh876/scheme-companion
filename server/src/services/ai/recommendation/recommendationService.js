import { extractUserProfile } from "../../ai/groqService.js";        // ✅ 2 levels up
import { getExtractor } from "../../embeddingModel.js";           // ✅ 2 levels up
import prisma from "../../../config/prisma.js";                    // ✅ 3 levels up
import { scoreScheme } from "../../ai/scoringEngine.js";              // ✅ 2 levels up
import { embeddingCache } from "../../../utils/cache.js";          // ✅ 3 levels up
import { buildQueryText } from "./searchTextBuilder.js";           // ✅ same folder
import { normalizeCategory } from "./utils.js";                    // ✅ same folder
import { buildSchemeFilters } from "../../filterBuilder.js";       // ✅ 2 levels up

const MAX_RESULTS = 20;

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

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (Number(a[i]) || 0) * (Number(b[i]) || 0);
    normA += (Number(a[i]) || 0) ** 2;
    normB += (Number(b[i]) || 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

const deduplicateSchemes = (schemes) => {
  const seen = new Set();
  return schemes.filter(s => {
    const key = s.externalId?.trim() || s.name?.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const applyDiversity = (sorted, maxResults, primaryIntent) => {
  if (!sorted.length) return [];
  
  const intentCat = primaryIntent && primaryIntent !== "unknown"
    ? normalizeCategory(primaryIntent.replace(/-/g, " "))
    : null;
  
  const result = [], counts = {};
  for (const s of sorted) {
    const cat = normalizeCategory(s.category);
    const cap = cat === intentCat ? 10 : 5;
    if ((counts[cat] || 0) < cap) {
      result.push(s);
      counts[cat] = (counts[cat] || 0) + 1;
      if (result.length >= maxResults) break;
    }
  }
  
  if (result.length < maxResults) {
    for (const s of sorted) {
      if (!result.includes(s)) {
        result.push(s);
        if (result.length >= maxResults) break;
      }
    }
  }
  
  return result;
};

export const recommendSchemes = async (message) => {
  const trimmed = (message || "").trim();
  if (!trimmed) return { error: "message is required" };

  const profile = await extractUserProfile(trimmed);
  const queryText = buildQueryText(profile, trimmed);
  const queryEmbedding = await getQueryEmbedding(queryText);

  const filterWhere = buildSchemeFilters(profile, { strictOccupation: false });
  
  const allSchemes = await prisma.scheme.findMany({
    where: filterWhere,
    select: {
      id: true, name: true, description: true, benefits: true,
      eligibility: true, category: true, ministry: true, state: true,
      allowedCategories: true, allowedStates: true, allowedGenders: true,
      allowedOccupations: true, allowedEducationLevels: true,
      minIncome: true, maxIncome: true, minAge: true, maxAge: true,
      isFemaleOnly: true, applicationLink: true, sourceUrl: true,
      tags: true, embedding: true, externalId: true,
    },
  });

  let schemesToScore = allSchemes;
  if (allSchemes.length === 0) {
    schemesToScore = await prisma.scheme.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, description: true, benefits: true,
        eligibility: true, category: true, ministry: true, state: true,
        allowedCategories: true, allowedStates: true, allowedGenders: true,
        allowedOccupations: true, allowedEducationLevels: true,
        minIncome: true, maxIncome: true, minAge: true, maxAge: true,
        isFemaleOnly: true, applicationLink: true, sourceUrl: true,
        tags: true, embedding: true, externalId: true,
      },
    });
  }

  const withSimilarity = schemesToScore.map(s => ({
    ...s,
    _similarity: cosineSimilarity(queryEmbedding, s.embedding),
  }));
  withSimilarity.sort((a, b) => b._similarity - a._similarity);

  const scored = withSimilarity.map(s => {
    const { score, hardConflicts } = scoreScheme(s, profile);
    return { ...s, _score: score, _hardConflicts: hardConflicts };
  });

  const eligible = scored.filter(s => s._hardConflicts === 0);
  const valid = eligible.filter(s => s._score >= 0.35);

  if (!valid.length) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: { total: 0, candidatesEvaluated: schemesToScore.length },
    };
  }

  valid.sort((a, b) => b._score - a._score);
  const deduped = deduplicateSchemes(valid);
  const diverse = applyDiversity(deduped, MAX_RESULTS, profile.primaryIntent);

  const results = diverse.map(({ embedding, _similarity, _score, _hardConflicts, ...rest }) => ({
    ...rest,
    relevanceScore: Math.round(_score * 100),
  }));

  return {
    profile: { ...profile },
    schemes: results,
    meta: { total: results.length, candidatesEvaluated: schemesToScore.length },
  };
};