import { normalizeState } from "./groqService.js";
import { SCORE } from "./recommendation/constants/scoreConstants.js";
import { PATTERNS } from "./recommendation/constants/patternConstants.js";

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

const normalizeCategory = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

const INTENT_SCORE_CATEGORIES = {
  treatment: ["Health & Wellness", "Medical"],
  medical:   ["Health & Wellness", "Medical"],
  scholarship: ["Education & Learning", "Scholarship"],
  student:   ["Education & Learning", "Scholarship"],
  loan:      ["Banking,Financial Services and Insurance", "Loan"],
  "startup-funding": ["Business & Entrepreneurship", "Startup"],
  business:  ["Business & Entrepreneurship"],
  farmer:    ["Agriculture, Rural & Environment"],
  job:       ["Skills & Employment", "Employment"],
  unemployed:["Skills & Employment", "Employment"],
  maternity: ["Health & Wellness", "Women and Child"],
  disability:["Social welfare & Empowerment", "Disability"],
  marriage:  ["Social welfare & Empowerment", "Marriage"],
  death:     ["Social welfare & Empowerment"],
  "widow-support": ["Social welfare & Empowerment", "Women and Child"],
};
const NORMALIZED_INTENT_SCORE_CATEGORIES = Object.fromEntries(
  Object.entries(INTENT_SCORE_CATEGORIES).map(([intent, cats]) => [
    intent,
    cats.map(normalizeCategory),
  ])
);

const FINANCIALLY_RELEVANT_CATEGORIES = new Set([
  "banking,financial services and insurance",
  "skills & employment",
]);
const NORMALIZED_FINANCIALLY_RELEVANT_CATEGORIES = new Set(
  Array.from(FINANCIALLY_RELEVANT_CATEGORIES).map(normalizeCategory)
);

const NORMALIZED_INTENT_ALLOWED_CATEGORIES = Object.fromEntries(
  Object.entries(SCORE.INTENT_ALLOWED_CATEGORIES || {}).map(([intent, set]) => [
    intent,
    new Set(Array.from(set).map(normalizeCategory)),
  ])
);

const INTENT_OCCUPATION_MAP = {
  farmer: "farmer",
  student: "student",
  "startup-funding": "startup",
  business: "startup",
  unemployed: "unemployed",
  "widow-support": "widow",
};

const userMentions = (msg, key) => PATTERNS.special[key]?.test(msg) ?? false;
const userMentionsDisability    = (msg) => userMentions(msg, "disability");
const userMentionsWidow         = (msg) => userMentions(msg, "widow");
const userMentionsSenior        = (msg) => userMentions(msg, "senior");
const userMentionsMedical       = (msg) => userMentions(msg, "medical");
const userMentionsJournalist    = (msg) => userMentions(msg, "journalist");
const userMentionsSports        = (msg) => userMentions(msg, "sports");
const userMentionsPregnancy     = (msg) => userMentions(msg, "pregnancy");
const userMentionsExServicemen  = (msg) => PATTERNS.special.exServicemen.test(msg);

const toArray = (v) => (Array.isArray(v) ? v : []);

const educationLevelConflicts = (schemeEduLevels = [], userEduLevel = "") => {
  if (!userEduLevel || userEduLevel === "unknown" || userEduLevel === "all") return false;
  if (schemeEduLevels.length === 0 || schemeEduLevels.includes("all")) return false;
  if (userEduLevel === "higher_education" && schemeEduLevels.every((l) => l === "school")) return true;
  if (userEduLevel === "school" && schemeEduLevels.every((l) => l === "higher_education")) return true;
  return false;
};

const isInstitutionalScheme = (scheme) => {
  if (scheme.schemeFor === "Institution") return true;
  const name = String(scheme.name || "").toLowerCase();
  const desc = String(scheme.description || "").toLowerCase();
  const elig = String(scheme.eligibility || "").toLowerCase();
  return (
    /margdarshan|incubat|institution\b|institute\b|college accredit|university accredit|nba accredit|naac accredit|research institution|host institute|technical institution|grant.in.aid institution|non.grant.in.aid institution|aided institution|institutions of eminence|eminence scheme/i.test(name) ||
    /\bfor institutions?\b|\bfor colleges?\b|\bfor universities\b|\bfor technical institutes?\b|\bfor grant.in.aid\b|\bfor non.grant\b/i.test(desc) ||
    /\bfor institutions?\b|\bfor colleges?\b|\bfor universities\b|\bfor technical institutes?\b/i.test(elig)
  );
};

const getExclusiveOccupation = (scheme) => {
  const name = String(scheme.name || "").toLowerCase();
  const desc = String(scheme.description || "").toLowerCase();
  const occ  = toArray(scheme.allowedOccupations);

  if (
    /construction worker|building worker|bocw|labour (dept|department)|labour board/i.test(name) ||
    /construction worker|building worker|bocw/i.test(desc)
  ) return "worker";

  if (/for handloom weaver|weaver.*mudra|handloom.*credit/i.test(name)) return "worker";

  if (
    /transport worker|truck driver|bus driver/i.test(name) ||
    /transport worker/i.test(desc)
  ) return "worker";

  if (occ.length > 0 && !occ.includes("all")) {
    if (occ.length === 1) return occ[0];
  }
  return null;
};

const isGenericFinancialScheme = (scheme) => PATTERNS.special.financial.test(`${scheme.name || ""} ${scheme.description || ""}`);
const isGenericBankingScheme   = (scheme) => PATTERNS.special.banking.test(`${scheme.name || ""} ${scheme.description || ""}`);
const isAwardScheme            = (scheme) => PATTERNS.special.award.test(String(scheme.name || ""));
const isOverseasScheme         = (scheme) => PATTERNS.special.overseas.test(`${scheme.name || ""} ${scheme.description || ""}`);
const isChildFocusedScheme     = (scheme) => PATTERNS.special.childFocused.test(`${scheme.name || ""} ${scheme.description || ""}`);
const isDeathAssistanceScheme  = (scheme) => PATTERNS.special.deathAssistance.test(`${scheme.name || ""} ${scheme.description || ""}`);

const DISEASE_SPECIFIC_REJECT = [
  { pattern: /nikshay|tb patient|tuberculosis/i,  disease: "tb" },
  { pattern: /aids|hiv positive|plhiv/i,          disease: "hiv" },
  { pattern: /leprosy|hansen.?s disease/i,         disease: "leprosy" },
  { pattern: /thalassemia/i,                       disease: "thalassemia" },
  { pattern: /sickle cell/i,                       disease: "sickle cell" },
  { pattern: /rare disease/i,                      disease: "rare disease" },
];
const DISEASE_MENTION_MAP = {
  tb:            /\btb\b|tuberculosis|nikshay/i,
  hiv:           /\bhiv\b|aids/i,
  leprosy:       /leprosy|hansen/i,
  thalassemia:   /thalassemia/i,
  "sickle cell": /sickle cell/i,
  "rare disease":/rare disease/i,
};
const isUnrelatedDiseaseScheme = (scheme, rawMessage) => {
  const nd = `${scheme.name || ""} ${scheme.description || ""}`;
  return DISEASE_SPECIFIC_REJECT.some(
    ({ pattern, disease }) => pattern.test(nd) && !DISEASE_MENTION_MAP[disease]?.test(rawMessage)
  );
};

// ─── EXTREME RESERVED SCHEME DETECTION ──────────────────────────────────────
// 🔧 FIX: this used to declare its own `reservedPatterns` array inline, and
// that array contained a broken regex literal (`/\bsc/st\b|.../i`) with an
// unescaped "/" that terminated the literal early and made "st" get parsed
// as regex flags — an invalid flag ("t"), which throws a SyntaxError the
// instant this module is imported. That means this hard-reject path (and
// therefore this whole file) could never have actually run in production
// as written. Now it just reads the shared, corrected list from
// PATTERNS.special.reservedCategory (see patternConstants.js).
const isReservedScheme = (nameLower, descLower, eligLower, tagsStr, allowedCategories) => {
  const combined = `${nameLower} ${descLower} ${eligLower} ${tagsStr}`;

  const isTextReserved = PATTERNS.special.reservedCategory.some((p) => p.test(combined));
  if (!isTextReserved) return false;

  const cats = toArray(allowedCategories);
  const hasGeneral = cats.some((c) => c.toLowerCase() === "general" || c.toLowerCase() === "all");
  return !hasGeneral;
};

export const scoreScheme = (
  scheme,
  profile,
  queryEmbedding,
  rawMessage,
  forSomeoneElse = false,
  beneficiaryProfile = null
) => {
  const {
    primaryIntent,
    secondaryIntents = [],
    intentConfidence = 0,
    emotion,
    emotionConfidence = 0,
    occupation,
    state,
    educationLevel,
    casteCategory,
    income,
    age,
    gender,
  } = profile;

  const baseEffectiveGender =
    gender === "unknown" && (occupation === "widow" || userMentionsWidow(rawMessage))
      ? "female"
      : gender;

  let filterGender  = baseEffectiveGender;
  let effectiveMinAge = age ?? null;
  let effectiveMaxAge = age ?? null;

  if (forSomeoneElse && beneficiaryProfile) {
    if (beneficiaryProfile.gender)            filterGender    = beneficiaryProfile.gender;
    if (beneficiaryProfile.minAge != null)    effectiveMinAge = beneficiaryProfile.minAge;
    if (beneficiaryProfile.maxAge != null)    effectiveMaxAge = beneficiaryProfile.maxAge;
  }

  const nameLower      = String(scheme.name        || "").toLowerCase();
  const descLower      = String(scheme.description || "").toLowerCase();
  const eligLower      = String(scheme.eligibility || "").toLowerCase();
  const tagsStr        = toArray(scheme.tags).join(" ").toLowerCase();
  const schemeCatLower = normalizeCategory(scheme.category);
  const allowedOccupations      = toArray(scheme.allowedOccupations);
  const allowedEducationLevels  = toArray(scheme.allowedEducationLevels);
  const allowedCategories       = toArray(scheme.allowedCategories);
  const allowedGenders          = toArray(scheme.allowedGenders);
  const combinedText            = `${nameLower} ${descLower} ${tagsStr} ${eligLower}`;

  const semanticScore = cosineSimilarity(queryEmbedding, scheme.embedding) * 100;

  // ══════════════════════════════════════════════════════════════════════
  // HARD REJECTS
  // ══════════════════════════════════════════════════════════════════════

  if (effectiveMinAge !== null) {
    if (scheme.minAge !== null && scheme.minAge !== undefined && effectiveMinAge < scheme.minAge) return SCORE.AGE_MISMATCH;
    if (scheme.maxAge !== null && scheme.maxAge !== undefined && effectiveMinAge > scheme.maxAge) return SCORE.AGE_MISMATCH;
  }
  if (effectiveMaxAge !== null && effectiveMaxAge !== effectiveMinAge) {
    if (scheme.minAge !== null && scheme.minAge !== undefined && effectiveMaxAge < scheme.minAge) return SCORE.AGE_MISMATCH;
    if (scheme.maxAge !== null && scheme.maxAge !== undefined && effectiveMinAge !== null && effectiveMinAge > scheme.maxAge) return SCORE.AGE_MISMATCH;
  }

  if (
    /old age|senior citizen|vayoshreshtha|old age pension|aged person/i.test(nameLower) ||
    /senior citizen|old age pension|60 years and above|above 60/i.test(descLower)
  ) {
    const isOldEnough = (effectiveMinAge !== null && effectiveMinAge >= 55) || userMentionsSenior(rawMessage);
    if (!isOldEnough) return SCORE.AGE_MISMATCH;
  }

  if (filterGender === "male") {
    if (
      /pregnant|maternity|pregnancy|delivery|antenatal|neonate|matritva|suman|miscarriage/i.test(nameLower) ||
      /pregnant|maternity|pregnancy|delivery|antenatal|neonate/i.test(descLower)
    ) return SCORE.SPECIAL_REJECT;

    const isWidowOnlyScheme =
      /widow pension|vidhwa pension|indira gandhi.*widow|bereaved wife/i.test(nameLower) ||
      (/widow/i.test(nameLower) && /widow/i.test(descLower));
    if (isWidowOnlyScheme) return SCORE.SPECIAL_REJECT;

    if (/adolescent girl|girl child|kishori|balika/i.test(nameLower)) return SCORE.SPECIAL_REJECT;
  }

  if (filterGender === "unknown" && !userMentionsPregnancy(rawMessage)) {
    const isMaternityScheme =
      /pregnant|maternity|pregnancy|delivery|antenatal|janani.*shishu|suman yojana|matritva/i.test(nameLower) ||
      /for pregnant women|for expectant mothers|prenatal|postnatal/i.test(descLower);
    if (isMaternityScheme) return SCORE.SPECIAL_REJECT;
  }

  if (effectiveMinAge !== null && effectiveMinAge >= 18 && isChildFocusedScheme(scheme)) {
    return SCORE.SPECIAL_REJECT;
  }

  if (!userMentionsDisability(rawMessage)) {
    const hasDisabilityContext =
      PATTERNS.special.disability.test(tagsStr) ||
      PATTERNS.special.disability.test(descLower) ||
      PATTERNS.special.disability.test(nameLower);
    if (hasDisabilityContext) return SCORE.DISABILITY_REJECT;
  }

  const schemeIsExServicemen =
    /\brmewf\b|\baffdf\b|ex.?servicem(an|en|women)|ex-service|sainik welfare|defence personnel scheme|\bcapf\b|\bcrpf\b|\bbsf\b|\bcisf\b|\bitbp\b|\bssb\b|\brpf\b|\brpsf\b|railway protection force|central armed police force|coast guard personnel/i.test(nameLower) ||
    /\brmewf\b|\baffdf\b|ex.?servicem(an|en|women)|non.?pensioner ex.?service/i.test(descLower);

  if (schemeIsExServicemen && !userMentionsExServicemen(rawMessage)) {
    return SCORE.SPECIAL_REJECT;
  }

  // 🆕 Freedom-fighter pensions and orphan/martyred-personnel-ward schemes:
  // same "requires explicit mention" treatment as ex-servicemen above.
  const combinedNameDesc = `${nameLower} ${descLower}`;
  if (
    PATTERNS.special.freedomFighter.test(combinedNameDesc) &&
    !PATTERNS.special.freedomFighter.test(rawMessage)
  ) {
    return SCORE.SPECIAL_REJECT;
  }
  if (
    PATTERNS.special.nicheBeneficiaryWard.test(combinedNameDesc) &&
    !PATTERNS.special.nicheBeneficiaryWard.test(rawMessage)
  ) {
    return SCORE.SPECIAL_REJECT;
  }

  if (
    /pradhan mantri garib kalyan package.*insurance.*health worker|health worker.*covid|covid.*health worker insurance/i.test(nameLower) ||
    /insurance scheme for health workers.*covid|health workers fighting covid/i.test(descLower)
  ) {
    const userIsHealthWorker =
      /health worker|doctor|nurse|asha|aanganwadi|paramedic|frontline worker|medical staff|hospital staff/i.test(rawMessage);
    if (!userIsHealthWorker) return SCORE.SPECIAL_REJECT;
  }

  if (!userMentionsJournalist(rawMessage) && /journalist|accredited journalist|press worker|media welfare/i.test(nameLower))
    return SCORE.SPECIAL_REJECT;
  if (!userMentionsSports(rawMessage) && /national award.*sport|welfare fund.*sport|sportsperson fund|athletes? fund/i.test(nameLower))
    return SCORE.SPECIAL_REJECT;
  if (
    (/parents of transgender|transgender children/i.test(nameLower) || /parents of transgender|transgender children/i.test(descLower)) &&
    !/transgender|kinnar|hijra/i.test(rawMessage)
  ) return SCORE.SPECIAL_REJECT;

  if (!forSomeoneElse) {
    const userIsChild = age !== null && age !== undefined && age < 18;
    if (!userIsChild) {
      const isChildScheme =
        /\bladli\b|girl child|bal vivah|kishori|kishori shakti|sabla|rgseag|national creche|child labour|juvenile/i.test(nameLower) ||
        /girl children|born.*girl|newborn|infant|children below 12|under.?5|0.?to.?5/i.test(descLower);
      if (isChildScheme && scheme.maxAge !== null && scheme.maxAge !== undefined && scheme.maxAge < 18)
        return SCORE.AGE_MISMATCH;
      if (isChildScheme && scheme.maxAge === null && /\bladli\b|girl child|girl children|born.*girl/i.test(`${nameLower} ${descLower}`))
        return SCORE.AGE_MISMATCH;
    }

    if (occupation !== "startup") {
      if (
        /startup|incubator/i.test(nameLower) &&
        allowedOccupations.includes("startup") &&
        !allowedOccupations.includes("all")
      ) return SCORE.STARTUP_NON_MATCH_PENALTY;
    }
  }

  if (isInstitutionalScheme(scheme)) return SCORE.SPECIAL_REJECT;

  // ─── EXTREME CASTE HARD REJECT ──────────────────────────────────────────
  const isGeneralUser = !casteCategory || casteCategory === "unknown" || casteCategory === "general";
  if (isGeneralUser) {
    // 1. Check allowedCategories
    const cats = toArray(scheme.allowedCategories);
    if (cats.length > 0 && !cats.includes("general") && !cats.includes("all")) {
      return SCORE.SPECIAL_REJECT;
    }
    // 2. Check name/desc/tags for reserved keywords
    if (isReservedScheme(nameLower, descLower, eligLower, tagsStr, allowedCategories)) {
      return SCORE.SPECIAL_REJECT;
    }
  }

  // ─── EDUCATION HARD REJECT ──────────────────────────────────────────────
  if (educationLevel && educationLevel !== "unknown" && educationLevel !== "all") {
    const eduLevels = toArray(scheme.allowedEducationLevels);
    if (eduLevels.length > 0 && !eduLevels.includes("all")) {
      if (educationLevel === "higher_education" && eduLevels.every(l => l === "school")) {
        return SCORE.SPECIAL_REJECT;
      }
      if (educationLevel === "school" && eduLevels.every(l => l === "higher_education")) {
        return SCORE.SPECIAL_REJECT;
      }
    }
    // Additional pre-matric check
    const isPreMatric = /pre.?matric|class\s*(8|9|1[0-2])|8th|9th|10th|11th|12th|secondary|matriculation|school education/i.test(nameLower);
    if (educationLevel === "higher_education" && isPreMatric) {
      if (eduLevels.length === 0 || eduLevels.every(l => l === "school")) {
        return SCORE.SPECIAL_REJECT;
      }
    }
  }

  // 🆕 Postgrad-only scheme shown to an undergraduate (or vice versa). The
  // profile schema only distinguishes higher_education vs school, not UG vs
  // PG within higher_education, so this checks the raw message directly
  // rather than requiring a schema/extraction change.
  const schemeIsPostgradOnly =
    /\bpost.?graduate\b|\bpg\s*(scholarship|studies|scheme)\b|\bphd\b|\bpost.?doctoral\b|\bm\.?tech\b.{0,15}\bonly\b|\bmasters?\b.{0,15}\bonly\b/i.test(nameLower);
  const userMentionsPostgrad = /\bm\.?tech\b|\bm\.?sc\b|\bm\.?a\b|\bmba\b|\bmca\b|\bpost.?grad|\bmasters?\b|\bphd\b|\bpursuing.{0,15}master/i.test(rawMessage);
  const userMentionsUndergrad = /\bb\.?tech\b|\bb\.?sc\b|\bb\.?a\b|\bb\.?com\b|\bbca\b|\bundergraduate\b|\b\(?hons\)?\b/i.test(rawMessage);
  if (schemeIsPostgradOnly && userMentionsUndergrad && !userMentionsPostgrad) {
    return SCORE.SPECIAL_REJECT;
  }

  // 🆕 This specific community-toilet loan scheme repeatedly surfaced in
  // completely unrelated result sets (farmer, cancer treatment, startup
  // loan) purely because its text is generic "loan / financial assistance"
  // boilerplate that scores well on semantic similarity against almost any
  // query. Name-based reject unless the user's intent is actually
  // sanitation/housing related.
  const isSanitationLoanScheme = /community toilet|pay\s*and\s*use.*toilet|toilet\s*construction\s*loan/i.test(nameLower);
  if (
    isSanitationLoanScheme &&
    primaryIntent !== "sanitation" &&
    primaryIntent !== "housing" &&
    !/toilet|shauchalay|sanitation/i.test(rawMessage)
  ) {
    return SCORE.SPECIAL_REJECT;
  }

  if (isAwardScheme(scheme) && !userMentionsSports(rawMessage)) {
    if (!/award|recognition|achievement|excellence|puraskar/i.test(rawMessage)) return SCORE.SPECIAL_REJECT;
  }

  if (isOverseasScheme(scheme) && !/overseas|abroad|foreign country|nri|non.?resident/i.test(rawMessage))
    return SCORE.SPECIAL_REJECT;

  if (isUnrelatedDiseaseScheme(scheme, rawMessage)) return SCORE.SPECIAL_REJECT;

  const isMedicalIntent = primaryIntent === "treatment" || primaryIntent === "medical" || userMentionsMedical(rawMessage);

  if (isMedicalIntent && intentConfidence > 0.5) {
    if (isGenericFinancialScheme(scheme)) return SCORE.SPECIAL_REJECT;

    const nameDescElig = `${nameLower} ${descLower} ${eligLower}`;
    if (
      /education loan|vidyalaxmi|shiksha.*loan|vocational.*loan|student loan|scholarship.*loan|interest subsidy.*education/i.test(nameDescElig) ||
      (scheme.isScholarship && /loan/i.test(nameLower))
    ) return SCORE.SPECIAL_REJECT;

    if (isDeathAssistanceScheme(scheme)) return SCORE.SPECIAL_REJECT;

    if (isGenericBankingScheme(scheme) && !/health|medical|treatment|hospital|insurance.*health|health.*insurance/i.test(combinedText)) {
      return SCORE.SPECIAL_REJECT;
    }
  }

  if (isMedicalIntent && intentConfidence > 0.65) {
    const isHealthOrFinance =
      /health|medical|wellness/i.test(schemeCatLower) ||
      /banking|financial|insurance/i.test(schemeCatLower);
    if (!isHealthOrFinance && semanticScore < SCORE.MEDICAL_SEMANTIC_THRESHOLD)
      return SCORE.SPECIAL_REJECT;
  }

  const allowedCategoriesForIntent = NORMALIZED_INTENT_ALLOWED_CATEGORIES?.[primaryIntent];
  let intentCategoryPenalty = 0;

  if (allowedCategoriesForIntent && intentConfidence > 0.6) {
    if (!allowedCategoriesForIntent.has(schemeCatLower)) {
      return SCORE.SPECIAL_REJECT;
    }
  } else if (!allowedCategoriesForIntent && intentConfidence > 0.5) {
    const broadMismatch =
      (primaryIntent === "loan"      && !/banking|financial|loan/i.test(schemeCatLower)) ||
      (primaryIntent === "job"       && !/employment|skills/i.test(schemeCatLower)) ||
      (primaryIntent === "treatment" && !/health|medical/i.test(schemeCatLower));
    if (broadMismatch && semanticScore < 55) return SCORE.SPECIAL_REJECT;
    if (broadMismatch) intentCategoryPenalty = SCORE.UNRELATED_CATEGORY_PENALTY;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCORING
  // ══════════════════════════════════════════════════════════════════════
  let score = semanticScore + intentCategoryPenalty;

  if (
    (primaryIntent === "treatment" || userMentionsMedical(rawMessage)) &&
    /cancer|tumor|tumour|oncology/i.test(rawMessage)
  ) {
    if (/cancer|tumor|tumour|oncology/i.test(combinedText)) score += SCORE.DISEASE_KEYWORD_BOOST;
  }

  if (primaryIntent === "widow-support" && /widow|death|family benefit|bereaved/i.test(combinedText))
    score += SCORE.HIGH_PRIORITY_INTENT;
  if (primaryIntent === "treatment" && /medical|health|treatment|hospital|cancer/i.test(combinedText))
    score += SCORE.HIGH_PRIORITY_INTENT;
  if (primaryIntent === "scholarship" && /scholarship|student|education/i.test(combinedText))
    score += SCORE.HIGH_PRIORITY_INTENT;
  if (primaryIntent === "farmer" && /farmer|agriculture|crop|kisan|fasal|bima/i.test(combinedText))
    score += SCORE.HIGH_PRIORITY_INTENT;
  if (primaryIntent === "disability" && /disab|pwd|divyang|differently.?abled/i.test(combinedText))
    score += SCORE.HIGH_PRIORITY_INTENT;
  if (primaryIntent === "maternity" && /maternity|pregnancy|prenatal|delivery|janani|suman/i.test(combinedText))
    score += SCORE.HIGH_PRIORITY_INTENT;

  if (primaryIntent === "maternity" || userMentionsPregnancy(rawMessage)) {
    const isMaternityScheme = 
      /maternity|pregnancy|delivery|prasav|janani|matru|shishu|garbh|garbhavati|antenatal|postnatal|matritva|maternal/.test(nameLower) ||
      /maternity|pregnancy|delivery|prasav|janani|matru|garbhavati|antenatal|postnatal|matritva/.test(descLower) ||
      /maternity|pregnancy|delivery/.test(tagsStr);
    if (isMaternityScheme) {
      score += SCORE.HIGH_PRIORITY_INTENT * 2.5;
    }
  }

  if (primaryIntent === "maternity" && intentConfidence > 0.7) {
    const isAwardOrHelpline =
      /award|puraskar|fellowship|post-doctoral|helpline|wise|nari shakti|vatsalya|protection|child/i.test(nameLower) ||
      /award|puraskar|fellowship|helpline|wise|nari shakti/i.test(descLower);
    if (isAwardOrHelpline) {
      score -= 40;
    }
  }

  if (occupation === "widow" || userMentionsWidow(rawMessage)) {
    const isWidowScheme =
      /widow|patavya|bereaved|deceased husband|widow pension/i.test(nameLower) ||
      /widow|patavya|bereaved|widow pension/i.test(descLower) ||
      /widow|patavya|bereaved/i.test(tagsStr);
    if (isWidowScheme) {
      score += SCORE.WIDOW_BONUS;
    } else {
      score += SCORE.WIDOW_PENALTY;
    }
  }

  if (primaryIntent && primaryIntent !== "unknown") {
    const intentCategories = NORMALIZED_INTENT_SCORE_CATEGORIES[primaryIntent] || [];
    const categoryMatch    = intentCategories.some((c) => schemeCatLower.includes(c));

    if (categoryMatch) {
      score +=
        (primaryIntent === "treatment" || primaryIntent === "medical"
          ? SCORE.HIGH_PRIORITY_INTENT
          : SCORE.INTENT_MATCH) * intentConfidence;
    }

    const intentOccupation = INTENT_OCCUPATION_MAP[primaryIntent];
    if (intentOccupation && (allowedOccupations.includes(intentOccupation) || allowedOccupations.includes("all"))) {
      score += SCORE.OCCUPATION_MATCH * intentConfidence;
    }

    if ((primaryIntent === "scholarship" || primaryIntent === "student") && scheme.isScholarship) {
      score += SCORE.SCHOLARSHIP_EXACT_MATCH_BOOST * intentConfidence;
    }

    for (const si of secondaryIntents) {
      const siCats = NORMALIZED_INTENT_SCORE_CATEGORIES[si] || [];
      if (siCats.some((c) => schemeCatLower.includes(c))) {
        score += 6;
        break;
      }
    }

    if (intentConfidence > 0.6 && intentCategories.length > 0 && !categoryMatch) {
      const penalty = NORMALIZED_FINANCIALLY_RELEVANT_CATEGORIES.has(schemeCatLower) ? -5 : SCORE.CATEGORY_MISMATCH;
      score += penalty;
    }
  }

  if (occupation && occupation !== "unknown") {
    const occupationMatches = allowedOccupations.includes(occupation) || allowedOccupations.includes("all");
    let occBonus = 0;
    if (occupationMatches) {
      occBonus = SCORE.OCCUPATION_MATCH;
      const intentRelevant = (
        (primaryIntent === "maternity" && /maternity|pregnancy|delivery|prasav|garbh/i.test(combinedText)) ||
        (primaryIntent === "farmer" && /farmer|agriculture|crop|kisan|kheti/i.test(combinedText)) ||
        (primaryIntent === "scholarship" && /scholarship|student|education|fee/i.test(combinedText)) ||
        (primaryIntent === "treatment" && /treatment|health|hospital|disease|surgery/i.test(combinedText)) ||
        (primaryIntent === "widow-support" && /widow|bereaved|death|husband|pati/i.test(combinedText))
      );
      if (intentRelevant && intentConfidence > 0.6) {
        occBonus *= 2;
      }
      score += occBonus;
    } else if (!allowedOccupations.includes("all") && allowedOccupations.length > 0) {
      const occPenalty = isMedicalIntent ? -15 : SCORE.OCCUPATION_MISMATCH;
      score += occPenalty;
    }
  }

  const exclusiveOcc = getExclusiveOccupation(scheme);
  if (exclusiveOcc && occupation !== exclusiveOcc && occupation !== "unknown") {
    score += SCORE.OCCUPATION_MISMATCH * 2;
  } else if (exclusiveOcc && occupation === "unknown" && !isMedicalIntent) {
    score += SCORE.OCCUPATION_MISMATCH;
  }

  if (educationLevel && educationLevel !== "unknown") {
    if (allowedEducationLevels.includes(educationLevel) || allowedEducationLevels.includes("all")) {
      score += SCORE.EDUCATION_MATCH;
    } else if (educationLevelConflicts(allowedEducationLevels, educationLevel)) {
      score += SCORE.EDUCATION_CONFLICT;
    }
  }

  if ((primaryIntent === "scholarship" || primaryIntent === "student") && educationLevel === "school") {
    const isHigherEdOnly =
      /phd|research scholar|post.?doctoral|fellowship.*research|academician|cultural research/i.test(nameLower) ||
      /for orphan|for wards of.*police|for wards of.*military|cpf personnel|for children of.*martyred/i.test(descLower);
    if (isHigherEdOnly) score += SCORE.EDUCATION_CONFLICT;
  }

  if (casteCategory && casteCategory !== "unknown") {
    if (allowedCategories.includes(casteCategory)) score += SCORE.CASTE_MATCH;
    if (casteCategory === "general") {
      const isReservedFocused =
        /\bsc\b|scheduled caste|dalit|\bst\b|scheduled tribe|tribal|\bobc\b|backward class|minority scholarship/i.test(nameLower) ||
        /\bsc\b|scheduled caste|dalit|\bst\b|scheduled tribe|tribal|\bobc\b|backward class/i.test(descLower);
      if (isReservedFocused) {
        score += SCORE.RESERVED_CATEGORY_PENALTY;
      }
    }
  }

  const SPECIFIC_INTENTS = new Set([
    "treatment", "medical", "widow-support", "maternity", "disability",
    "scholarship", "student", "job", "unemployed", "farmer", "housing",
    "sanitation", "pension", "marriage", "death"
  ]);
  if (
    SPECIFIC_INTENTS.has(primaryIntent) &&
    intentConfidence > 0.4 &&
    (isGenericBankingScheme(scheme) || isGenericFinancialScheme(scheme))
  ) {
    score += SCORE.GENERIC_SCHEME_PENALTY;
  }

  if (
    isMedicalIntent &&
    intentConfidence > 0.5 &&
    NORMALIZED_FINANCIALLY_RELEVANT_CATEGORIES.has(schemeCatLower) &&
    !/health|medical|treatment|hospital|patient|cancer|insurance|illness|disease/i.test(combinedText)
  ) {
    score += SCORE.HEALTH_FINANCE_PENALTY;
  }

  const schemeStates     = toArray(scheme.allowedStates).map((s) => String(s).toLowerCase().replace(/\s/g, ""));
  const schemeStateScalar = String(scheme.state || "").toLowerCase().replace(/\s/g, "");
  const isNational =
    schemeStates.length === 0 ||
    schemeStates.includes("all") ||
    schemeStateScalar === "allindia" ||
    schemeStateScalar === "all";

  if (!state || state === "unknown") {
    if (!isNational) score += SCORE.STATE_UNKNOWN_NON_NATIONAL_PENALTY;
  } else {
    const normalizedState = normalizeState(state);
    const isStateMatch    = schemeStates.includes(normalizedState);
    score += isNational || isStateMatch ? SCORE.STATE_MATCH : SCORE.STATE_MISMATCH;
  }

  if (baseEffectiveGender === "female" && scheme.isFemaleOnly) score += SCORE.FEMALE_BONUS;
  if (scheme.isFemaleOnly && baseEffectiveGender !== "female") {
    if (baseEffectiveGender && baseEffectiveGender !== "unknown") {
      // Confirmed non-female user + female-only scheme: hard reject rather
      // than a soft penalty. A -15 penalty was routinely losing to schemes
      // with a semantic score of 70-100 (e.g. "Mahila Samriddhi Yojana"
      // surfacing for a male entrepreneur asking about MUDRA/PMEGP loans).
      return SCORE.SPECIAL_REJECT;
    }
    score += SCORE.GENDER_MISMATCH;
  }
  if (
    baseEffectiveGender &&
    baseEffectiveGender !== "unknown" &&
    baseEffectiveGender !== "other" &&
    allowedGenders.length > 0 &&
    !allowedGenders.includes(baseEffectiveGender) &&
    !allowedGenders.includes("all")
  ) {
    // Same reasoning as the isFemaleOnly check above — confirmed gender
    // mismatch against an explicit allow-list is a hard reject, not a soft
    // penalty that a high semantic score can absorb.
    return SCORE.SPECIAL_REJECT;
  }

  if (
    income !== null && income !== undefined &&
    scheme.maxIncome !== null && scheme.maxIncome !== undefined &&
    income > scheme.maxIncome
  ) {
    score += SCORE.INCOME_PENALTY;
  }

  if (emotion && emotion !== "unknown" && emotionConfidence > 0.6) {
    if (["urgent", "desperate", "worried", "anxious"].includes(emotion)) {
      score += SCORE.EMOTION_BONUS * emotionConfidence;
    }
  }

  return score;
};