import { getExtractor } from "../../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../scoringEngine.js";
import { embeddingCache, candidateCache } from "../../../utils/cache.js";
import { buildQueryText } from "./searchTextBuilder.js";
import { extractUserProfile } from "../groqService.js";
import { keywordSearch } from "./keywordSearch.js";
import { reciprocalRankFusion } from "./rrf.js";
import { rerank, isRerankerActive } from "./reranker.js";
import { getCachedEligibilityRules, enqueueEligibilityExtraction } from "./eligibilityService.js";
import { verifyEligibility } from "./verification.js";
import { createMetrics, logMetrics } from "./metrics.js";

const MAX_RESULTS = 20;

// Hybrid retrieval configuration. Values are initial/experimental per the
// design doc; tune against the eval harness (server/eval).
const VECTOR_TOP_K = 100; // semantic candidates (recall-focused)
const KEYWORD_TOP_K = 100; // full-text candidates (recall-focused)
const CANDIDATE_POOL = 200; // max unique candidates after RRF fusion
const RERANK_INPUT = 50; // candidates passed to the reranker stage
const ELIGIBILITY_TOP_N = 30; // top candidates that get eligibility extraction+verification

// Only what scoring + hard filtering need. Embeddings dominate payload size, so
// text/display columns are fetched separately for the final top results.
const CANDIDATE_SELECT = {
  id: true,
  name: true,
  description: true,
  benefits: true,
  eligibility: true,
  category: true,
  state: true,
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

const CANDIDATE_PAGE = 300;
let candidatesLoadPromise = null;

const loadCandidates = async () => {
  // Read the current catalogue from PostgreSQL. A persistent JSON snapshot can
  // silently hide schemes added or changed by the six-hour sync.
  const rows = [];
  let skip = 0;

  for (;;) {
    let page = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        page = await prisma.scheme.findMany({
          where: { isActive: true },
          select: CANDIDATE_SELECT,
          orderBy: { id: "asc" },
          skip,
          take: CANDIDATE_PAGE,
        });
        break;
      } catch (err) {
        if (attempts >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    rows.push(...page);
    if (page.length < CANDIDATE_PAGE) break;
    skip += CANDIDATE_PAGE;
  }

  return rows;
};

const getCandidates = async () => {
  const cached = candidateCache.get("active");
  if (cached) return cached;

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
  // Warm the Prisma connection + full-text path.
  try {
    await keywordSearch("pension", 1);
  } catch (err) {
    console.warn("⚠️ FTS warm skipped:", err.message);
  }
};

export const invalidateCandidateCache = () => {
  candidateCache.del("active");
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
    { pattern: /\b(?:unorganised|unorganized)\s+(?:sector\s+)?workers?|\bcrafts(?:wo)?men\b/i, allowed: profile.occupation === "worker" || /\b(?:unorganised|unorganized)\s+(?:sector\s+)?workers?|\bcrafts(?:wo)?men\b/i.test(rawMessage) },
    { pattern: /\b(?:construction worker|building worker|registered construction labourer)\b/i, allowed: /\b(?:construction worker|building worker|labou?rer|mazdoor)\b/i.test(rawMessage) },
    { pattern: /\b(?:ex[- ]servicemen|ex[- ]serviceman|veteran)\b/i, allowed: /\b(?:ex[- ]servicemen|ex[- ]serviceman|veteran|army|navy|air force)\b/i.test(rawMessage) },
    { pattern: /\b(?:central armed police|police force personnel|paramilitary personnel)\b/i, allowed: /\b(?:central armed police|police force|paramilitary)\b/i.test(rawMessage) },
    { pattern: /\b(?:farmer|agricultural worker|cultivator)\b/i, allowed: profile.occupation === "farmer" || /\b(?:farmer|farming|agriculture)\b/i.test(rawMessage) },
    { pattern: /\b(?:teachers?|lecturers?)\b/i, allowed: /\b(?:teachers?|lecturers?)\b/i.test(rawMessage) },
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
    // Many catalogue rows have a single scheme.state but no allowedStates
    // array. Use that state for regional filtering instead of treating them as
    // location-neutral. Explicit "all India" values remain unrestricted.
    const applicableStates = allowedStates.length
      ? allowedStates
      : scheme.state
      ? [String(scheme.state).toLowerCase().replace(/[^a-z0-9]/g, "").trim()]
      : [];

    if (
      applicableStates.length > 0 &&
      !applicableStates.includes("all") &&
      !applicableStates.includes("allindia")
    ) {
      if (!applicableStates.includes(userState)) {
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

const detectMedicalTreatmentRequest = (rawMessage) =>
  /\b(?:cancer|tumou?rs?|chemotherap\w*|radiotherap\w*|dialysis|organ transplant|critical illness|serious illness|incurable disease|treatment|medical care)\b/i.test(rawMessage);

const hasMedicalTreatmentEvidence = (scheme) => {
  if (scheme.category === "Education & Learning" || scheme.isScholarship) {
    return false;
  }

  const text = [scheme.name, scheme.description, scheme.benefits, scheme.eligibility, ...(scheme.tags || [])]
    .filter(Boolean)
    .join(" ");

  if (
    /\b(?:studying medical|medical (?:college|education|courses?|students?))\b/i.test(text) &&
    !/\b(?:cancer|chemotherap\w*|radiotherap\w*|dialysis|organ transplant|incurable disease|patient|treatment)\b/i.test(text)
  ) {
    return false;
  }

  const diseaseEvidence =
    /\b(?:cancer|tumou?rs?|chemotherap\w*|radiotherap\w*|dialysis|organ transplant|critical illness|serious illness|incurable diseases?|medical treatment|treatment of (?:a )?diseases?)\b/i.test(text);
  const medicalAidEvidence =
    /\b(?:medical|health(?:care)?|hospital)\s+(?:assistance|support|aid|treatment|care|expenses?|costs?|loan|insurance|fund)\b|\b(?:financial assistance|reimbursement|health insurance)\b.{0,80}\b(?:medical|health|hospital|treatment|disease|illness|cancer)\b/i.test(text);
  return diseaseEvidence || medicalAidEvidence;
};

const isCancerTreatmentRequest = (rawMessage) =>
  /\b(?:cancer|tumou?rs?|oncolog\w*|chemotherap\w*|radiotherap\w*)\b/i.test(rawMessage);

const filterForCancerTreatment = (schemes) => {
  const directTreatment =
    /\b(?:cancer|tumou?rs?|oncolog\w*|chemotherap\w*|radiotherap\w*)\b/i;
  const financialAid =
    /\b(?:financial assistance|medical assistance|treatment assistance|patient fund|treatment cost|medical expenses?|grant|relief fund|cashless treatment|health cover|health insurance)\b/i;
  const researchOrRecognition =
    /\b(?:research|fellowship|training|award|best state|population decline|entrepreneurship)\b/i;

  return schemes.filter((scheme) => {
    const fullText = getSchemeSearchText(scheme);
    const namedText = [scheme.name, ...(scheme.tags || [])].filter(Boolean).join(" ");
    const explicitCancerScheme = directTreatment.test(namedText) && financialAid.test(fullText);
    const generalMedicalGrant =
      /\bhealth minister(?:'s)? discretionary grant\b/i.test(scheme.name || "") &&
      /\b(?:medical|treatment|hospital|illness)\b/i.test(fullText) &&
      financialAid.test(fullText);

    // A disease mention in a research, award, or population programme is not
    // evidence that the scheme pays for a patient's treatment.
    if (!explicitCancerScheme && !generalMedicalGrant) return false;
    if (researchOrRecognition.test(namedText) && !financialAid.test(namedText)) return false;
    return true;
  });
};

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
 * Ranks all in-memory candidates by the SAME dual cosine similarity the scorer
 * uses (0.5*description + 0.5*eligibility), returning the top-K as a ranked
 * list for RRF fusion. Pure/in-memory — no I/O.
 */
const vectorSearchRank = (candidates, queryEmbedding, topK) => {
  const scored = [];
  for (const s of candidates) {
    const hasDesc = Array.isArray(s.descriptionEmbedding) && s.descriptionEmbedding.length > 0;
    const hasElig = Array.isArray(s.eligibilityEmbedding) && s.eligibilityEmbedding.length > 0;
    if (!hasDesc && !hasElig) continue;

    const descSim = hasDesc ? cosineSimilarity(queryEmbedding, s.descriptionEmbedding) : 0;
    const eligSim = hasElig ? cosineSimilarity(queryEmbedding, s.eligibilityEmbedding) : 0;

    let sim;
    if (hasDesc && hasElig) sim = 0.5 * descSim + 0.5 * eligSim;
    else if (hasDesc) sim = descSim;
    else sim = eligSim;

    scored.push({ id: s.id, score: sim });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
};

/**
 * Hybrid retrieval: parallel vector + keyword search fused with RRF, then
 * deduplicated into a candidate pool of full scheme objects.
 * Degrades gracefully — if keyword search fails it returns [], and fusion
 * becomes vector-only, so retrieval never hard-fails the request.
 */
const hybridRetrieve = async (allCandidates, queryEmbedding, keywordText) => {
  const keywordPromise = keywordSearch(keywordText, KEYWORD_TOP_K);
  const vectorRanked = vectorSearchRank(allCandidates, queryEmbedding, VECTOR_TOP_K);
  const keywordRanked = await keywordPromise;

  const fused = reciprocalRankFusion([vectorRanked, keywordRanked]);
  const poolIds = fused.slice(0, CANDIDATE_POOL).map((f) => f.id);

  const byId = new Map(allCandidates.map((s) => [s.id, s]));

  // Keyword search hits the live DB, so it can surface schemes added since
  // this process loaded its in-memory candidate catalogue. Backfill those ids.
  const missingIds = poolIds.filter((id) => !byId.has(id));
  if (missingIds.length) {
    try {
      const rows = await prisma.scheme.findMany({
        where: { id: { in: missingIds } },
        select: CANDIDATE_SELECT,
      });
      rows.forEach((r) => byId.set(r.id, r));
    } catch (err) {
      console.warn("[hybrid] backfill of keyword-only candidates failed:", err.message);
    }
  }

  const schemes = [];
  const rrfById = new Map();
  for (const f of fused) {
    if (schemes.length >= CANDIDATE_POOL) break;
    const scheme = byId.get(f.id);
    if (!scheme) continue;
    schemes.push(scheme);
    rrfById.set(f.id, f.rrfScore);
  }

  return {
    schemes,
    rrfById,
    counts: {
      vector: vectorRanked.length,
      keyword: keywordRanked.length,
      fused: fused.length,
      pool: schemes.length,
    },
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

  const metrics = createMetrics();

  // 1. Extract structured profile from user conversation
  const profile = await metrics.time("profileExtraction", () => extractUserProfile(trimmed, {
    onLLMCall: () => metrics.addLlm(1),
    onUsage: (usage) => metrics.addTokens(usage.total_tokens || 0),
  }));

  // 2. Build semantic query text and generate query embedding
  const queryText = buildQueryText(profile, trimmed);
  const queryEmbedding = await metrics.time("queryEmbedding", () => getQueryEmbedding(queryText));

  // 3. Load all active schemes (cached), then narrow to a hybrid candidate pool
  //    (vector + keyword search fused via RRF).
  const allCandidates = await metrics.time("loadCandidates", () => getCandidates());

  if (!allCandidates.length) {
    return {
      profile: { ...profile },
      schemes: [],
      meta: { total: 0, candidatesEvaluated: 0, engine: "hybrid" },
    };
  }

  // Keyword search targets the official-vocabulary paraphrase plus the raw
  // message; comma-separated phrases become OR clauses for recall.
  const keywordText = [profile.searchQuery, trimmed].filter(Boolean).join(", ");
  const retrieval = await metrics.time("hybridRetrieval", () =>
    hybridRetrieve(allCandidates, queryEmbedding, keywordText)
  );
  metrics.count("vectorCandidates", retrieval.counts.vector);
  metrics.count("keywordCandidates", retrieval.counts.keyword);
  metrics.count("fusedCandidates", retrieval.counts.fused);
  metrics.count("candidatePool", retrieval.counts.pool);

  // Rerank the recall-focused hybrid pool before eligibility and legacy scoring.
  // Keep the remaining candidates in their RRF order as a fallback tail.
  const rerankInput = retrieval.schemes.slice(0, RERANK_INPUT).map((scheme) => ({
    ...scheme,
    relevance: retrieval.rrfById.get(scheme.id) || 0,
  }));
  const reranked = (await metrics.time("rerank", () => rerank(queryText, rerankInput))).map(
    ({ relevance, reranked: _rerankedFlag, _rerankIndex, ...scheme }) => scheme
  );
  const rerankedIds = new Set(reranked.map((scheme) => scheme.id));
  const candidateSchemes = [
    ...reranked,
    ...retrieval.schemes.filter((scheme) => !rerankedIds.has(scheme.id)),
  ];
  metrics.count("rerankCandidates", rerankInput.length);

  if (!candidateSchemes.length) {
    const summary = metrics.summary();
    logMetrics("empty-pool", summary);
    return {
      profile: { ...profile },
      schemes: [],
      meta: {
        total: 0,
        candidatesEvaluated: allCandidates.length,
        engine: "hybrid",
        monitoring: summary,
      },
    };
  }

  // Keep explicit startup-funding requests focused on schemes whose source data
  // actually mentions startup finance, incubation, or entrepreneurship. If the
  // catalogue has no such evidence, retain semantic fallback instead of returning
  // an empty list.
  const abroadMatches = filterForStudyAbroad(candidateSchemes, profile, trimmed);
  const widowMatches = filterForWidowSupport(candidateSchemes, profile, trimmed);
  const asksForMedicalTreatment = detectMedicalTreatmentRequest(trimmed);
  const cancerSpecificRequest = isCancerTreatmentRequest(trimmed);
  const medicallyRelevantMatches = asksForMedicalTreatment
    ? candidateSchemes.filter(hasMedicalTreatmentEvidence)
    : candidateSchemes;
  const medicalMatches = cancerSpecificRequest
    ? filterForCancerTreatment(medicallyRelevantMatches)
    : medicallyRelevantMatches;
  const asksForStudyAbroad =
    profile.primaryIntent === "scholarship" &&
    /\b(?:abroad|overseas|outside\s+india|foreign\s+(?:university|study|education))\b/i.test(trimmed);
  const asksForWidowSupport = profile.primaryIntent === "widow-support";

  if (
    (asksForStudyAbroad && abroadMatches.length === 0) ||
    (asksForWidowSupport && widowMatches.length === 0) ||
    (asksForMedicalTreatment && medicalMatches.length === 0)
  ) {
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
    : medicalMatches;
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
  poolToRank.sort((a, b) => {
    if (cancerSpecificRequest) {
      const priority = (scheme) => {
        const namedText = [scheme.name, ...(scheme.tags || [])].filter(Boolean).join(" ");
        return /\b(?:cancer|tumou?rs?|oncolog\w*|chemotherap\w*|radiotherap\w*)\b/i.test(namedText) ? 1 : 0;
      };
      const priorityDifference = priority(b) - priority(a);
      if (priorityDifference !== 0) return priorityDifference;
    }
    return b._score - a._score;
  });

  // 8. Deduplicate identical schemes
  const deduped = deduplicateSchemes(poolToRank);

  // 10. Eligibility verification from CACHED rules (no LLM in the request path).
  //     Missing/stale schemes are enqueued for rate-limited background
  //     extraction, so the cache warms over time without adding latency or
  //     tripping the provider token budget. Uncached schemes stay "unknown".
  const eligibilityCandidates = [...deduped].sort((a, b) => {
    if (isRerankerActive() && Number.isFinite(a.crossEncoderScore) && Number.isFinite(b.crossEncoderScore)) {
      return b.crossEncoderScore - a.crossEncoderScore;
    }
    return b._score - a._score;
  });
  const eligInput = eligibilityCandidates.slice(0, ELIGIBILITY_TOP_N);
  let verified = eligInput.map((s) => ({ ...s, _eligibilityStatus: "unknown", _eligibilityChecks: [] }));
  try {
    const { rules, missing, stats } = await metrics.time("eligibilityCache", () =>
      getCachedEligibilityRules(eligInput.map((s) => ({ id: s.id, eligibility: s.eligibility })))
    );
    metrics.addEligibilityStats({ cacheHits: stats.cacheHits, missing: stats.missing });
    metrics.count("eligibilityMissing", stats.missing);

    if (missing.length) {
      const enqueued = enqueueEligibilityExtraction(missing);
      metrics.count("eligibilityEnqueued", enqueued);
    }

    verified = eligInput.map((s) => {
      const v = verifyEligibility(rules.get(s.id) || null, profile);
      return { ...s, _eligibilityStatus: v.status, _eligibilityChecks: v.checks };
    });
  } catch (err) {
    console.warn("[eligibility] verification stage skipped:", err.message);
  }
  metrics.count("verifiedCandidates", verified.length);

  // 11. Final ranking — relevance and eligibility kept SEPARATE. Confirmed
  //     mismatch is excluded; confirmed match is prioritized; unknown is kept
  //     but ranked lower (never treated as confirmed eligible).
  const cancerPriority = (scheme) => {
    if (!cancerSpecificRequest) return 0;
    const namedText = [scheme.name, ...(scheme.tags || [])].filter(Boolean).join(" ");
    return /\b(?:cancer|tumou?rs?|oncolog\w*|chemotherap\w*|radiotherap\w*)\b/i.test(namedText) ? 1 : 0;
  };
  const statusRank = (s) =>
    s._eligibilityStatus === "match" ? 0 : s._eligibilityStatus === "unknown" ? 1 : 2;

  const finalRanked = verified
    .filter((s) => s._eligibilityStatus !== "no_match")
    .sort((a, b) => {
      const cd = cancerPriority(b) - cancerPriority(a);
      if (cd !== 0) return cd;
      const sd = statusRank(a) - statusRank(b);
      if (sd !== 0) return sd;
      if (isRerankerActive() && Number.isFinite(a.crossEncoderScore) && Number.isFinite(b.crossEncoderScore)) {
        return b.crossEncoderScore - a.crossEncoderScore;
      }
      return b._score - a._score;
    });

  const resultLimit = asksForMedicalTreatment ? Math.min(MAX_RESULTS, 8) : MAX_RESULTS;
  const topResults = finalRanked.slice(0, resultLimit);

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
      _eligibilityStatus,
      _eligibilityChecks,
      ...rest
    }) => ({
      ...rest,
      ...displayById.get(rest.id),
      relevanceScore: Math.round(_score * 100),
      eligibilityStatus: _eligibilityStatus,
      eligibilityChecks: _eligibilityChecks,
    })
  );

  const summary = metrics.summary();
  logMetrics(profile.primaryIntent || "query", summary);

  return {
    profile: { ...profile },
    schemes: results,
    meta: {
      total: results.length,
      candidatesEvaluated: candidateSchemes.length,
      engine: "hybrid",
      rerankerActive: isRerankerActive(),
      monitoring: summary,
    },
  };
};
