import { getExtractor } from "../../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../scoringEngine.js";
import { embeddingCache, candidateCache } from "../../../utils/cache.js";
import { buildQueryText } from "./searchTextBuilder.js";
import { extractUserProfile } from "../groqService.js";

const MAX_RESULTS = 20;

// Only what scoring + hard filtering need. Embeddings dominate payload size, so
// text/display columns are fetched separately for the final top results.
const CANDIDATE_SELECT = {
  id: true,
  name: true,
  description: true,
  benefits: true,
  eligibility: true,
  category: true,
  tags: true,
  externalId: true,
  gender: true,
  occupation: true,
  educationLevel: true,
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
  descriptionEmbedding: true,
  eligibilityEmbedding: true,
};

const DISPLAY_SELECT = {
  id: true,
  name: true,
  description: true,
  benefits: true,
  eligibility: true,
  documentsRequired: true,
  category: true,
  ministry: true,
  state: true,
  gender: true,
  occupation: true,
  educationLevel: true,
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
};

// One 4.7k-row embedding fetch is large enough to drop the Postgres connection,
// so page it into smaller round-trips.
const CANDIDATE_PAGE = 800;
let candidatesLoadPromise = null;

const loadCandidates = async () => {
  const rows = [];
  let skip = 0;

  for (;;) {
    const page = await prisma.scheme.findMany({
      where: { isActive: true },
      select: CANDIDATE_SELECT,
      orderBy: { id: "asc" },
      skip,
      take: CANDIDATE_PAGE,
    });

    rows.push(...page);
    if (page.length < CANDIDATE_PAGE) break;
    skip += CANDIDATE_PAGE;
  }

  return rows;
};

const getCandidates = async () => {
  const cached = candidateCache.get("active");
  if (cached) return cached;

  // A cold cache can coincide with startup warmup and several incoming searches.
  // Share one database read so each request does not start its own 5k-row scan.
  if (!candidatesLoadPromise) {
    candidatesLoadPromise = loadCandidates()
      .then((rows) => {
        candidateCache.set("active", rows);
        return rows;
      })
      .finally(() => {
        candidatesLoadPromise = null;
      });
  }

  return candidatesLoadPromise;
};

export const warmCandidateCache = async () => {
  try {
    const rows = await getCandidates();
    console.log(` Candidate cache warmed (${rows.length} schemes).`);
  } catch (err) {
    console.error("❌ Candidate cache warm failed:", err.message);
  }
};

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
export const checkHardEligibility = (scheme, profile, rawMessage = "") => {
  const conflicts = [];
  const schemeText = [
    scheme.name,
    scheme.description,
    scheme.benefits,
    scheme.eligibility,
    ...(scheme.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

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

      // Many imported schemes do not have structured gender filters. Catch
      // unambiguous women/widow/maternity-only schemes from their source text.
      if (
        /\b(?:widow|widows|maternity|pregnan(?:t|cy)|girl child|women in distress)\b/.test(schemeText) ||
        /\b(?:only|exclusively|solely)\s+(?:for\s+)?(?:women|woman|female|girls?)\b/.test(schemeText) ||
        /\b(?:women|woman|female)\s+(?:entrepreneurs?|applicants?|beneficiaries|students?|founders?)\b/.test(schemeText)
      ) {
        conflicts.push("female_targeted_scheme");
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

  // Explicit SC/ST-only programmes should not be recommended to a general
  // category applicant, even when the source omitted structured category data.
  if (profile.casteCategory === "general") {
    const titleAndTags = [scheme.name, ...(scheme.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const reservedOnlyPattern =
      /\b(?:sc(?:\s*(?:&|and|\/)\s*st)?|st|scheduled caste(?:s)?|scheduled tribes?|obcs?|ebcs?|bcs?|backward classes?|minorities)\b/;

    if (reservedOnlyPattern.test(titleAndTags)) {
      conflicts.push("reserved_category_only");
    }
  }

  // Do not surface schemes reserved for a specific community when the
  // applicant's profile does not establish that they belong to it.
  const titleAndTags = [scheme.name, ...(scheme.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const userCategory = (profile.casteCategory || "unknown").toLowerCase();
  const explicitReservedTarget =
    /\b(?:scheduled castes?|sc students?|\bsc\b|scheduled tribes?|st students?|\bst\b|obc students?|\bobc\b|ebc students?|\bebc\b|backward classes?|minority students?)\b/.exec(titleAndTags);
  if (explicitReservedTarget) {
    const label = explicitReservedTarget[0];
    const target = /scheduled caste|\bsc\b/.test(label)
      ? "sc"
      : /scheduled tribe|\bst\b/.test(label)
      ? "st"
      : /\bobc\b|backward class/.test(label)
      ? "obc"
      : /\bebc\b/.test(label)
      ? "ebc"
      : "minority";
    if (userCategory !== target) conflicts.push("reserved_category_only");
  }

  // Exclude occupation- or service-specific loans when the request does not
  // identify the applicant as belonging to that group.
  const targetRules = [
    { pattern: /\b(?:safai karamchari|sanitation worker|scavenger)\b/i, allowed: /\b(?:safai karamchari|sanitation worker|scavenger)\b/i.test(rawMessage) },
    { pattern: /\b(?:construction worker|building worker|registered construction labourer)\b/i, allowed: /\b(?:construction worker|building worker|labou?rer|mazdoor)\b/i.test(rawMessage) },
    { pattern: /\b(?:ex[- ]servicemen|ex[- ]serviceman|veteran)\b/i, allowed: /\b(?:ex[- ]servicemen|ex[- ]serviceman|veteran|army|navy|air force)\b/i.test(rawMessage) },
    { pattern: /\b(?:central armed police|police force personnel|paramilitary personnel)\b/i, allowed: /\b(?:central armed police|police force|paramilitary)\b/i.test(rawMessage) },
    { pattern: /\b(?:farmer|agricultural worker|cultivator)\b/i, allowed: profile.occupation === "farmer" || /\b(?:farmer|farming|agriculture)\b/i.test(rawMessage) },
  ];
  if (targetRules.some(({ pattern, allowed }) => pattern.test(titleAndTags) && !allowed)) {
    conflicts.push("target_group_mismatch");
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

const INTENT_EVIDENCE = {
  "startup-funding": /\b(?:start[\s-]?ups?|incubat(?:or|ion)|seed fund(?:ing)?|venture capital|accelerator|angel investor|dpiit recognition|founders?)\b/i,
};

const getSchemeSearchText = (scheme) =>
  [scheme.name, scheme.description, scheme.benefits, scheme.eligibility, scheme.category, ...(scheme.tags || [])]
    .filter(Boolean)
    .join(" ");

const filterForStudyAbroad = (schemes, profile, rawMessage) => {
  const asksForStudyAbroad =
    profile.primaryIntent === "scholarship" &&
    /\b(?:abroad|overseas|outside\s+india|foreign\s+(?:university|study|education))\b/i.test(rawMessage);

  if (!asksForStudyAbroad) return schemes;

  const overseasEvidence =
    /\b(?:abroad|overseas|outside\s+india|foreign\s+(?:university|institution|study|education))\b/i;
  const undergraduateOnly =
    /\b(?:undergraduate|under\s*graduate|ug\s+students?)\b.{0,50}\b(?:only|scholarship|students?)\b|\b(?:only|exclusively)\s+(?:for\s+)?(?:undergraduate|under\s*graduate|ug)\b/i;
  const doctoralOnly =
    /\b(?:doctoral|doctorate|ph\.?d\.?|doctoral\s+fellowship)\b/i;
  const disabilityTarget =
    /\b(?:students?|persons?|people)\s+with\s+disabilit(?:y|ies)\b|\bspecially[- ]abled\b|\bdivyang\b/i;
  const text = (scheme) => getSchemeSearchText(scheme);

  // An explicit overseas-study request should never be padded with domestic
  // schemes. MTech/Master's applicants also should not get UG-only or PhD-only
  // programmes in the list.
  return schemes.filter((scheme) => {
    const searchable = text(scheme);
    if (!overseasEvidence.test(searchable)) return false;
    if (undergraduateOnly.test(`${scheme.name || ""} ${(scheme.tags || []).join(" ")} ${scheme.eligibility || ""}`)) return false;
    if (doctoralOnly.test(`${scheme.name || ""} ${(scheme.tags || []).join(" ")}`)) return false;
    if (disabilityTarget.test(`${scheme.name || ""} ${(scheme.tags || []).join(" ")}`) && !/\bdisabilit|specially[- ]abled|divyang\b/i.test(rawMessage)) return false;
    return true;
  });
};

const filterForWidowSupport = (schemes, profile, rawMessage) => {
  if (profile.primaryIntent !== "widow-support") return schemes;

  const askedAboutMarriage = /\b(?:marriage|remarri(?:age|ed)|shaadi|vivah)\b/i.test(rawMessage);
  const askedAboutPregnancy = /\b(?:pregnan\w*|maternity|expecting|garbhwati)\b/i.test(rawMessage);
  const mentionedChildren = /\b(?:child(?:ren)?|kids?|daughter|son|girl child|bachch\w*|bcho|bache)\b/i.test(rawMessage);
  const mentionedWorkerStatus = /\b(?:construction worker|labou?rer|mazdoor|shramik|safai karamchari|sanitation worker)\b/i.test(rawMessage);
  const age = Number(profile.age);

  const widowEvidence =
    /\b(?:widow|widows|destitute women|women in distress|single women|widow pension)\b/i;
  const familyDeathEvidence =
    /\b(?:national family benefit|death of (?:the )?(?:primary )?breadwinner|death of (?:the )?head of (?:the )?family)\b/i;

  return schemes.filter((scheme) => {
    const namedText = [scheme.name, ...(scheme.tags || [])].filter(Boolean).join(" ");
    const fullText = getSchemeSearchText(scheme);
    if (!widowEvidence.test(namedText) && !familyDeathEvidence.test(fullText)) return false;

    if (!askedAboutMarriage && /\b(?:marriage|remarriage|girl marriage|kanyadan)\b/i.test(namedText)) return false;
    if (!askedAboutPregnancy && /\b(?:maternity|pregnan\w*|matritva)\b/i.test(namedText)) return false;
    if (!mentionedChildren && /\b(?:child|children|daughter|girl child|bal seva|kanya sumangala)\b/i.test(namedText)) return false;
    if (!mentionedWorkerStatus && /\b(?:shramik|construction worker|labou?rer|safai karamchari|sanitation worker)\b/i.test(namedText)) return false;
    if (age < 60 && /\b(?:old age|senior citizens?|vayoshreshtha)\b/i.test(namedText)) return false;
    if (/\b(?:award|puraskar|prize|best institution|best district)\b/i.test(namedText)) return false;

    return true;
  });
};

const detectLoanPurposes = (rawMessage) => {
  const text = rawMessage.toLowerCase();
  const asksForLoan = /\b(?:loan|credit|udhaar)\b/.test(text);
  if (!asksForLoan) return [];

  const mentionsChildren = /\b(?:children?|kids?|b(?:a)?ch(?:ch)?o?n?\w*|bcho|bache)\b/.test(text);
  const mentionsEducation = /\b(?:education|school|college|stud(?:y|ies)|padhai)\b/.test(text);
  const mentionsHome = /\b(?:ghar|house|home|makaan|housing)\b/.test(text);
  const mentionsConstruction = /\b(?:construction|build|building|ban(?:a|an|wa)|repair)\w*\b/.test(text);

  const purposes = [];
  if (mentionsChildren && mentionsEducation) purposes.push("education");
  if (mentionsHome && mentionsConstruction) purposes.push("housing");
  return purposes;
};

const matchesLoanPurpose = (scheme, purpose) => {
  const text = getSchemeSearchText(scheme);
  const loanEvidence = /\b(?:loan|credit|finance|financing|interest subsidy)\b/i.test(text);

  if (purpose === "education") {
    return loanEvidence && /\b(?:education|educational|student|study|tuition|school|college)\b/i.test(text);
  }

  if (purpose === "housing") {
    const homeEvidence = /\b(?:home|house|housing|dwelling|residential|ghar|makaan)\b/i.test(text);
    const sanitationOnly = /\b(?:toilet|community toilet|sanitation|shauchalaya)\b/i.test(`${scheme.name || ""} ${(scheme.tags || []).join(" ")}`);
    return loanEvidence && homeEvidence && !sanitationOnly;
  }

  return true;
};

const hasIntentEvidence = (scheme, intent) => {
  const pattern = INTENT_EVIDENCE[intent];
  if (!pattern) return true;

  const namedFields = [scheme.name, ...(scheme.tags || [])]
    .filter(Boolean)
    .join(" ");
  if (pattern.test(namedFields)) return true;

  // Keep named entrepreneur-support funding schemes while excluding generic
  // self-employment and artisan programmes that only mention entrepreneurship
  // somewhere in their long description.
  const supportText = [scheme.description, scheme.benefits]
    .filter(Boolean)
    .join(" ");
  return (
    /\bentrepreneur(?:ship)?\b/i.test(scheme.name || "") &&
    /\b(?:financial assistance|financial support|subsidy|grant|soft loan|capital investment|funding|loan)\b/i.test(supportText)
  );
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

  // 3. Retrieve all active schemes (cached) for in-memory semantic scoring
  const candidateSchemes = await getCandidates();

  if (!candidateSchemes.length) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: { total: 0, candidatesEvaluated: 0 },
    };
  }

  // Keep explicit startup-funding requests focused on schemes whose source data
  // actually mentions startup finance, incubation, or entrepreneurship. If the
  // catalogue has no such evidence, retain semantic fallback instead of returning
  // an empty list.
  const abroadMatches = filterForStudyAbroad(candidateSchemes, profile, trimmed);
  const widowMatches = filterForWidowSupport(candidateSchemes, profile, trimmed);
  const asksForStudyAbroad =
    profile.primaryIntent === "scholarship" &&
    /\b(?:abroad|overseas|outside\s+india|foreign\s+(?:university|study|education))\b/i.test(trimmed);
  const asksForWidowSupport = profile.primaryIntent === "widow-support";

  if ((asksForStudyAbroad && abroadMatches.length === 0) || (asksForWidowSupport && widowMatches.length === 0)) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: { total: 0, candidatesEvaluated: candidateSchemes.length },
    };
  }

  const intentCandidates = asksForWidowSupport
    ? widowMatches
    : asksForStudyAbroad
    ? abroadMatches
    : candidateSchemes;
  const loanPurposes = detectLoanPurposes(trimmed);
  const purposeCandidates = loanPurposes.length
    ? intentCandidates.filter((scheme) => loanPurposes.some((purpose) => matchesLoanPurpose(scheme, purpose)))
    : intentCandidates;

  if (loanPurposes.length && purposeCandidates.length === 0) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: { total: 0, candidatesEvaluated: candidateSchemes.length },
    };
  }

  const intentMatches = purposeCandidates.filter((scheme) =>
    hasIntentEvidence(scheme, profile.primaryIntent)
  );
  const schemesForRanking = intentMatches.length ? intentMatches : purposeCandidates;

  // 4. Compute dual semantic similarities & evaluate hard eligibility
  const evaluated = schemesForRanking.map((scheme) => {
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
    const { isEligible, conflicts } = checkHardEligibility(scheme, profile, trimmed);

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

  // 10. Attach full display fields for the top results only, then format
  const displayRows = await prisma.scheme.findMany({
    where: { id: { in: topResults.map((s) => s.id) } },
    select: DISPLAY_SELECT,
  });
  const displayById = new Map(displayRows.map((row) => [row.id, row]));

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
      ...displayById.get(rest.id),
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
