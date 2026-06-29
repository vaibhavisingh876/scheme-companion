import { normalizeState } from "../ai/groqService.js";
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

const FINANCIALLY_RELEVANT_CATEGORIES = new Set([
  "banking,financial services and insurance",
  "skills & employment",
]);

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
const userMentionsExServicemen  = (msg) =>
  /ex.?servicem(an|en)|veteran|sainik|defence personnel|\barmy\b|\bnavy\b|air force|\bfauji\b|military service|\brpf\b|\brpsf\b|\bcrpf\b|\bcisf\b|\bbsf\b|\bitbp\b|\bssb\b|\bcapf\b|coast guard/i.test(msg);

const toArray = (v) => (Array.isArray(v) ? v : []);

const educationLevelConflicts = (schemeEduLevels = [], userEduLevel = "") => {
  if (!userEduLevel || userEduLevel === "unknown" || userEduLevel === "all") return false;
  if (schemeEduLevels.length === 0 || schemeEduLevels.includes("all")) return false;
  if (userEduLevel === "higher_education" && schemeEduLevels.every((l) => l === "school")) return true;
  if (userEduLevel === "school" && schemeEduLevels.every((l) => l === "higher_education")) return true;
  return false;
};

const isExclusivelyReservedCategory = (scheme) => {
  const cats = toArray(scheme.allowedCategories);
  if (cats.length === 0 || cats.includes("general")) return false;
  return cats.every((c) => ["sc", "st", "obc", "minority"].includes(c));
};

const isInstitutionalScheme = (scheme) => {
  const name = String(scheme.name        || "").toLowerCase();
  const desc = String(scheme.description || "").toLowerCase();
  const elig = String(scheme.eligibility || "").toLowerCase();
  return (
    /margdarshan|incubat|institution\b|institute\b|college accredit|university accredit|nba accredit|naac accredit|research institution|host institute|technical institution|grant.in.aid institution|non.grant.in.aid institution|aided institution|institutions of eminence|eminence scheme/i.test(name) ||
    /\bfor institutions?\b|\bfor colleges?\b|\bfor universities\b|\bfor technical institutes?\b|\bfor grant.in.aid\b|\bfor non.grant\b/i.test(desc) ||
    /\bfor institutions?\b|\bfor colleges?\b|\bfor universities\b|\bfor technical institutes?\b/i.test(elig)
  );
};

// ── Occupation-exclusive scheme detection ────────────────────────────────────
// Returns the exclusive occupation a scheme is locked to, or null if open to all.
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

const GENERIC_FINANCIAL_SCHEME_PATTERNS = [
  /national savings certificate|nsc.*viii|post office.*income|monthly income scheme|pomis/i,
  /nps vatsalya|pension.*minor|minor.*pension/i,
  /mahila samman savings|savings certificate/i,
  /public provident fund|\bppf\b/i,
  /sukanya samriddhi/i,
  /handloom.*mudra|weaver.*mudra|mudra.*weaver|mudra.*handloom/i,
  /sfurti|fund for regeneration of traditional industries/i,
  /khadi.*loan|khadi.*credit/i,
  /swatantrata sainik|freedom fighter.*pension/i,
];
const isGenericFinancialScheme = (scheme) => {
  const nd = `${scheme.name || ""} ${scheme.description || ""}`.toLowerCase();
  return GENERIC_FINANCIAL_SCHEME_PATTERNS.some((p) => p.test(nd));
};

// ── Generic banking schemes that don't actually help with specific medical/treatment needs ──
const GENERIC_BANKING_PATTERNS = [
  /pradhan mantri jan dhan|pmjdy|jan dhan yojana/i,
  /pradhan mantri jeevan jyoti bima|pmjjby/i,
  /pradhan mantri suraksha bima|pmsby/i,
  /atal pension yojana/i,
  /kisan vikas patra/i,
  /post office savings|recurring deposit|fixed deposit.*scheme/i,
];
const isGenericBankingScheme = (scheme) => {
  const nd = `${scheme.name || ""} ${scheme.description || ""}`.toLowerCase();
  return GENERIC_BANKING_PATTERNS.some((p) => p.test(nd));
};

const AWARD_SCHEME_PATTERNS = [
  /national youth award/i,
  /national award.*excel/i,
  /bravery award/i,
  /pradhan mantri rashtriya bal puraskar/i,
  /guru shishya|repertory grant|cultural.*grant.*perform/i,
];
const isAwardScheme = (scheme) =>
  AWARD_SCHEME_PATTERNS.some((p) => p.test(String(scheme.name || "")));

const OVERSEAS_SCHEME_PATTERNS = [
  /indian community welfare fund|icwf/i,
  /overseas indian|pravasi bharatiya/i,
  /non.?resident indian|\bnri\b/i,
];
const isOverseasScheme = (scheme) => {
  const nd = `${scheme.name || ""} ${scheme.description || ""}`;
  return OVERSEAS_SCHEME_PATTERNS.some((p) => p.test(nd));
};

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

const isChildFocusedScheme = (scheme) => {
  const name = String(scheme.name || "").toLowerCase();
  const desc = String(scheme.description || "").toLowerCase();
  return (
    /child|children|school|mid.?day|meal|poshan|anganwadi|creche|juvenile/i.test(name) ||
    /child|children|school|mid.?day|meal|anganwadi|creche/i.test(desc)
  );
};

// ── Death-assistance scheme detector ─────────────────────────────────────────
const isDeathAssistanceScheme = (scheme) => {
  const name = String(scheme.name || "").toLowerCase();
  const desc = String(scheme.description || "").toLowerCase();
  return (
    /accidental death|natural death|funeral assistance|antim.*anudan|kabir.*anthyesthi|death.*assistance|death.*grant/i.test(name) ||
    /in case.*death.*breadwinner|death of.*earning member|breadwinner.*death/i.test(desc)
  );
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
  const schemeCatLower = String(scheme.category    || "").toLowerCase();
  const allowedOccupations      = toArray(scheme.allowedOccupations);
  const allowedEducationLevels  = toArray(scheme.allowedEducationLevels);
  const allowedCategories       = toArray(scheme.allowedCategories);
  const allowedGenders          = toArray(scheme.allowedGenders);
  const combinedText            = `${nameLower} ${descLower} ${tagsStr} ${eligLower}`;

  const semanticScore = cosineSimilarity(queryEmbedding, scheme.embedding) * 100;

  // ══════════════════════════════════════════════════════════════════════
  // HARD REJECTS
  // ══════════════════════════════════════════════════════════════════════

  // Age bounds
  if (effectiveMinAge !== null) {
    if (scheme.minAge !== null && scheme.minAge !== undefined && effectiveMinAge < scheme.minAge) return SCORE.AGE_MISMATCH;
    if (scheme.maxAge !== null && scheme.maxAge !== undefined && effectiveMinAge > scheme.maxAge) return SCORE.AGE_MISMATCH;
  }
  if (effectiveMaxAge !== null && effectiveMaxAge !== effectiveMinAge) {
    if (scheme.minAge !== null && scheme.minAge !== undefined && effectiveMaxAge < scheme.minAge) return SCORE.AGE_MISMATCH;
    if (scheme.maxAge !== null && scheme.maxAge !== undefined && effectiveMinAge !== null && effectiveMinAge > scheme.maxAge) return SCORE.AGE_MISMATCH;
  }

  // Senior-only schemes
  if (
    /old age|senior citizen|vayoshreshtha|old age pension|aged person/i.test(nameLower) ||
    /senior citizen|old age pension|60 years and above|above 60/i.test(descLower)
  ) {
    const isOldEnough = (effectiveMinAge !== null && effectiveMinAge >= 55) || userMentionsSenior(rawMessage);
    if (!isOldEnough) return SCORE.AGE_MISMATCH;
  }

  // ── Gender-based rejects ──────────────────────────────────────────────
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

  // FIX: Reject maternity/pregnancy schemes when gender is UNKNOWN and user
  // hasn't mentioned pregnancy — prevents them flooding results for male workers.
  if (filterGender === "unknown" && !userMentionsPregnancy(rawMessage)) {
    const isMaternityScheme =
      /pregnant|maternity|pregnancy|delivery|antenatal|janani.*shishu|suman yojana|matritva/i.test(nameLower) ||
      /for pregnant women|for expectant mothers|prenatal|postnatal/i.test(descLower);
    if (isMaternityScheme) return SCORE.SPECIAL_REJECT;
  }

  // Child-focused schemes for adult beneficiaries
  if (effectiveMinAge !== null && effectiveMinAge >= 18 && isChildFocusedScheme(scheme)) {
    return SCORE.SPECIAL_REJECT;
  }

  // Disability schemes — only show if user mentioned disability
  if (!userMentionsDisability(rawMessage)) {
    const hasDisabilityContext =
      PATTERNS.special.disability.test(tagsStr) ||
      PATTERNS.special.disability.test(descLower) ||
      PATTERNS.special.disability.test(nameLower);
    if (hasDisabilityContext) return SCORE.DISABILITY_REJECT;
  }

  // ── Ex-servicemen schemes ─────────────────────────────────────────────
  const schemeIsExServicemen =
    /\brmewf\b|\baffdf\b|ex.?servicem(an|en|women)|ex-service|sainik welfare|defence personnel scheme|\bcapf\b|\bcrpf\b|\bbsf\b|\bcisf\b|\bitbp\b|\bssb\b|\brpf\b|\brpsf\b|railway protection force|central armed police force|coast guard personnel/i.test(nameLower) ||
    /\brmewf\b|\baffdf\b|ex.?servicem(an|en|women)|non.?pensioner ex.?service/i.test(descLower);

  if (schemeIsExServicemen && !userMentionsExServicemen(rawMessage)) {
    // FIX: Previously the check allowed ex-servicemen schemes through for any widow.
    // RMEWF/AFFDF are specifically for "widows of ex-servicemen", not widows in general.
    // Now we only allow it through if the user EXPLICITLY mentions ex-servicemen context.
    return SCORE.SPECIAL_REJECT;
  }

  // ── COVID health worker scheme — only for health workers ──────────────
  if (
    /pradhan mantri garib kalyan package.*insurance.*health worker|health worker.*covid|covid.*health worker insurance/i.test(nameLower) ||
    /insurance scheme for health workers.*covid|health workers fighting covid/i.test(descLower)
  ) {
    const userIsHealthWorker =
      /health worker|doctor|nurse|asha|aanganwadi|paramedic|frontline worker|medical staff|hospital staff/i.test(rawMessage);
    if (!userIsHealthWorker) return SCORE.SPECIAL_REJECT;
  }

  // ── Niche group rejects ───────────────────────────────────────────────
  if (!userMentionsJournalist(rawMessage) && /journalist|accredited journalist|press worker|media welfare/i.test(nameLower))
    return SCORE.SPECIAL_REJECT;
  if (!userMentionsSports(rawMessage) && /national award.*sport|welfare fund.*sport|sportsperson fund|athletes? fund/i.test(nameLower))
    return SCORE.SPECIAL_REJECT;
  if (
    (/parents of transgender|transgender children/i.test(nameLower) || /parents of transgender|transgender children/i.test(descLower)) &&
    !/transgender|kinnar|hijra/i.test(rawMessage)
  ) return SCORE.SPECIAL_REJECT;

  // Speaker-specific child-scheme rejects
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

  // Universal hard rejects
  if (isInstitutionalScheme(scheme)) return SCORE.SPECIAL_REJECT;

  const casteIsUnknownOrGeneral = !casteCategory || casteCategory === "unknown" || casteCategory === "general";
  if (casteIsUnknownOrGeneral && isExclusivelyReservedCategory(scheme)) return SCORE.CATEGORY_MISMATCH;

  if (isAwardScheme(scheme) && !userMentionsSports(rawMessage)) {
    if (!/award|recognition|achievement|excellence|puraskar/i.test(rawMessage)) return SCORE.SPECIAL_REJECT;
  }

  if (isOverseasScheme(scheme) && !/overseas|abroad|foreign country|nri|non.?resident/i.test(rawMessage))
    return SCORE.SPECIAL_REJECT;

  if (isUnrelatedDiseaseScheme(scheme, rawMessage)) return SCORE.SPECIAL_REJECT;

  // ── Medical intent: filter irrelevant schemes ─────────────────────────
  const isMedicalIntent = primaryIntent === "treatment" || primaryIntent === "medical" || userMentionsMedical(rawMessage);

  if (isMedicalIntent && intentConfidence > 0.5) {
    if (isGenericFinancialScheme(scheme)) return SCORE.SPECIAL_REJECT;

    const nameDescElig = `${nameLower} ${descLower} ${eligLower}`;
    if (
      /education loan|vidyalaxmi|shiksha.*loan|vocational.*loan|student loan|scholarship.*loan|interest subsidy.*education/i.test(nameDescElig) ||
      (scheme.isScholarship && /loan/i.test(nameLower))
    ) return SCORE.SPECIAL_REJECT;

    // FIX: Reject death-assistance schemes when user needs medical help (alive)
    if (isDeathAssistanceScheme(scheme)) return SCORE.SPECIAL_REJECT;

    // FIX: Reject generic banking products (Jan Dhan, PMJJBY) for medical queries
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

  // ── Intent-based category filter ─────────────────────────────────────
  const allowedCategoriesForIntent = SCORE.INTENT_ALLOWED_CATEGORIES?.[primaryIntent];
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

  // Disease keyword boost
  if (
    (primaryIntent === "treatment" || userMentionsMedical(rawMessage)) &&
    /cancer|tumor|tumour|oncology/i.test(rawMessage)
  ) {
    if (/cancer|tumor|tumour|oncology/i.test(combinedText)) score += SCORE.DISEASE_KEYWORD_BOOST;
  }

  // ── Intent boosts ─────────────────────────────────────────────────────
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

  // FIX: Strong maternity boost — ensure maternity schemes score very high
  // for maternity intent. JNSK / SUMAN / PMMVY need to outrank generic health.
  if (primaryIntent === "maternity") {
    if (/janani.*shishu|suman|matru|jsy|jssk|pradhan mantri.*matru/i.test(nameLower)) {
      score += SCORE.HIGH_PRIORITY_INTENT * 2;
    }
  }

  // ── Widow bonus / penalty ─────────────────────────────────────────────
  if (occupation === "widow" || userMentionsWidow(rawMessage)) {
    const isWidowScheme =
      /widow|patavya|bereaved|deceased husband|widow pension/i.test(nameLower) ||
      /widow|patavya|bereaved|widow pension/i.test(descLower) ||
      /widow|patavya|bereaved/i.test(tagsStr);
    score += isWidowScheme ? SCORE.WIDOW_BONUS : SCORE.WIDOW_PENALTY;
  }

  // ── Intent / category / occupation scoring ────────────────────────────
  if (primaryIntent && primaryIntent !== "unknown") {
    const intentCategories = INTENT_SCORE_CATEGORIES[primaryIntent] || [];
    const categoryMatch    = intentCategories.some((c) => schemeCatLower.includes(c.toLowerCase()));

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
      score += 6 * intentConfidence;
    }

    for (const si of secondaryIntents) {
      const siCats = INTENT_SCORE_CATEGORIES[si] || [];
      if (siCats.some((c) => schemeCatLower.includes(c.toLowerCase()))) {
        score += 6;
        break;
      }
    }

    if (intentConfidence > 0.6 && intentCategories.length > 0 && !categoryMatch) {
      const penalty = FINANCIALLY_RELEVANT_CATEGORIES.has(schemeCatLower) ? -5 : SCORE.CATEGORY_MISMATCH;
      score += penalty;
    }
  }

  // ── Occupation scoring ────────────────────────────────────────────────
  if (occupation && occupation !== "unknown") {
    if (allowedOccupations.includes(occupation) || allowedOccupations.includes("all")) {
      score += SCORE.OCCUPATION_MATCH;
    } else if (!allowedOccupations.includes("all") && allowedOccupations.length > 0) {
      const occPenalty = isMedicalIntent ? -15 : SCORE.OCCUPATION_MISMATCH;
      score += occPenalty;
    }
  }

  // FIX: Penalize occupation-exclusive schemes when user's occupation doesn't match.
  // This fixes construction worker schemes showing up for non-workers (Tests 2, 3).
  const exclusiveOcc = getExclusiveOccupation(scheme);
  if (exclusiveOcc && occupation !== exclusiveOcc && occupation !== "unknown") {
    score += SCORE.OCCUPATION_MISMATCH * 2;
  } else if (exclusiveOcc && occupation === "unknown" && !isMedicalIntent) {
    // For unknown occupation, mildly penalize very specific occupational schemes
    score += SCORE.OCCUPATION_MISMATCH;
  }

  // ── Education scoring ─────────────────────────────────────────────────
  if (educationLevel && educationLevel !== "unknown") {
    if (allowedEducationLevels.includes(educationLevel) || allowedEducationLevels.includes("all")) {
      score += SCORE.EDUCATION_MATCH;
    } else if (educationLevelConflicts(allowedEducationLevels, educationLevel)) {
      score += SCORE.EDUCATION_CONFLICT;
    }
  }

  // FIX: Penalize niche/specific scholarship schemes when they have extra
  // eligibility criteria clearly incompatible with the user (orphan, CPF ward, etc.)
  if ((primaryIntent === "scholarship" || primaryIntent === "student") && educationLevel === "school") {
    const isHigherEdOnly =
      /phd|research scholar|post.?doctoral|fellowship.*research|academician|cultural research/i.test(nameLower) ||
      /for orphan|for wards of.*police|for wards of.*military|cpf personnel|for children of.*martyred/i.test(descLower);
    if (isHigherEdOnly) score += SCORE.EDUCATION_CONFLICT;
  }

  // ── Caste / category scoring ──────────────────────────────────────────
  if (casteCategory && casteCategory !== "unknown") {
    if (allowedCategories.includes(casteCategory)) score += SCORE.CASTE_MATCH;
    if (casteCategory === "general") {
      const isReservedFocused =
        /\bsc\b|scheduled caste|dalit|\bst\b|scheduled tribe|tribal|\bobc\b|backward class|minority scholarship/i.test(nameLower) ||
        /\bsc\b|scheduled caste|dalit|\bst\b|scheduled tribe|tribal|\bobc\b|backward class/i.test(descLower);
      if (isReservedFocused) score += SCORE.RESERVED_CATEGORY_PENALTY;
    }
  }

  // ── Finance × health cross-penalty ───────────────────────────────────
  if (
    isMedicalIntent &&
    intentConfidence > 0.5 &&
    FINANCIALLY_RELEVANT_CATEGORIES.has(schemeCatLower) &&
    !/health|medical|treatment|hospital|patient|cancer|insurance|illness|disease/i.test(combinedText)
  ) {
    score += SCORE.HEALTH_FINANCE_PENALTY;
  }

  // ── State scoring ─────────────────────────────────────────────────────
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

  // ── Gender scoring ────────────────────────────────────────────────────
  if (baseEffectiveGender === "female" && scheme.isFemaleOnly) score += SCORE.FEMALE_BONUS;
  if (scheme.isFemaleOnly && baseEffectiveGender !== "female") score += SCORE.GENDER_MISMATCH;
  if (
    baseEffectiveGender &&
    baseEffectiveGender !== "unknown" &&
    baseEffectiveGender !== "other" &&
    allowedGenders.length > 0 &&
    !allowedGenders.includes(baseEffectiveGender) &&
    !allowedGenders.includes("all")
  ) {
    score += SCORE.GENDER_MISMATCH;
  }

  // ── Income scoring ────────────────────────────────────────────────────
  if (
    income !== null && income !== undefined &&
    scheme.maxIncome !== null && scheme.maxIncome !== undefined &&
    income > scheme.maxIncome
  ) {
    score += SCORE.INCOME_PENALTY;
  }

  // ── Emotion boost ─────────────────────────────────────────────────────
  if (emotion && emotion !== "unknown" && emotionConfidence > 0.6) {
    if (["urgent", "desperate", "worried", "anxious"].includes(emotion)) {
      score += SCORE.EMOTION_BONUS * emotionConfidence;
    }
  }

  return score;
};