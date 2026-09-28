import { extractUserProfile } from "../../ai/groqService.js";
import { getExtractor } from "../../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../../ai/scoringEngine.js";
import { embeddingCache } from "../../../utils/cache.js";
import { buildQueryText } from "./searchTextBuilder.js";
import { buildSchemeFilters } from "../../filterBuilder.js";

const MAX_RESULTS = 20;

const DESCRIPTION_WEIGHT = 0.65;
const ELIGIBILITY_WEIGHT = 0.35;

const getQueryEmbedding = async (queryText) => {
  const cacheKey = queryText.toLowerCase().trim();
  const cached = embeddingCache.get(cacheKey);

  if (cached) return cached;

  const extractor = await getExtractor();

  const output = await extractor(queryText, {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data);

  embeddingCache.set(cacheKey, embedding);

  return embedding;
};

const cosineSimilarity = (a, b) => {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.length === 0
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valueA = Number(a[i]) || 0;
    const valueB = Number(b[i]) || 0;

    dot += valueA * valueB;
    normA += valueA ** 2;
    normB += valueB ** 2;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  return denominator === 0 ? 0 : dot / denominator;
};

const deduplicateSchemes = (schemes) => {
  const seen = new Set();

  return schemes.filter((scheme) => {
    const key =
      scheme.externalId?.trim() ||
      scheme.name?.toLowerCase().replace(/\s+/g, " ").trim();

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const getSchemeCandidates = async (where) => {
  return prisma.scheme.findMany({
    where,
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
      applicationLink: true,
      sourceUrl: true,
      tags: true,
      externalId: true,

      embedding: true,
      descriptionEmbedding: true,
      eligibilityEmbedding: true,
    },
  });
};

export const recommendSchemes = async (message) => {
  const trimmed = (message || "").trim();

  if (!trimmed) {
    return { error: "message is required" };
  }

  const profile = await extractUserProfile(trimmed);

  const queryText = buildQueryText(profile, trimmed);
  const queryEmbedding = await getQueryEmbedding(queryText);

  const filterWhere = buildSchemeFilters(profile, {
    strictOccupation: true,
  });

  let schemesToScore = await getSchemeCandidates(filterWhere);

  if (schemesToScore.length === 0) {
    schemesToScore = await getSchemeCandidates({
      isActive: true,
    });
  }

  const withSimilarity = schemesToScore.map((scheme) => {
    const descriptionSimilarity = cosineSimilarity(
      queryEmbedding,
      scheme.descriptionEmbedding
    );

    const eligibilitySimilarity = cosineSimilarity(
      queryEmbedding,
      scheme.eligibilityEmbedding
    );

    const semanticSimilarity =
      descriptionSimilarity * DESCRIPTION_WEIGHT +
      eligibilitySimilarity * ELIGIBILITY_WEIGHT;

    return {
      ...scheme,
      _descriptionSimilarity: descriptionSimilarity,
      _eligibilitySimilarity: eligibilitySimilarity,
      _similarity: semanticSimilarity,
    };
  });

  withSimilarity.sort((a, b) => b._similarity - a._similarity);

  const scored = withSimilarity.map((scheme) => {
    const { score, hardConflicts } = scoreScheme(
      scheme,
      profile
    );

    return {
      ...scheme,
      _score: score,
      _hardConflicts: hardConflicts,
    };
  });

  const eligible = scored.filter(
    (scheme) => scheme._hardConflicts === 0
  );

  const valid = eligible.filter(
    (scheme) => scheme._score >= 0.35
  );

  if (!valid.length) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: {
        total: 0,
        candidatesEvaluated: schemesToScore.length,
      },
    };
  }

  valid.sort((a, b) => b._score - a._score);

  const deduped = deduplicateSchemes(valid);

  const topResults = deduped.slice(0, MAX_RESULTS);

  const results = topResults.map(
    ({
      embedding,
      descriptionEmbedding,
      eligibilityEmbedding,
      _descriptionSimilarity,
      _eligibilitySimilarity,
      _similarity,
      _score,
      _hardConflicts,
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
      candidatesEvaluated: schemesToScore.length,
    },
  };
};

