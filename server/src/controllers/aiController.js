import { extractUserProfile } from "../services/ai/groqService.js";
import { normalizeState } from "../services/ai/groqService.js";
import prisma from "../config/prisma.js";
import { pipeline } from "@xenova/transformers";


let extractorInstance = null;
const getExtractor = async () => {
  if (!extractorInstance) {
    extractorInstance = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return extractorInstance;
};


const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};


const HINDI_OCCUPATION_PATTERNS = [
  { pattern: /kisan|kisaan|krishak|annadata|kheti|khet|fasal|farming|farmer/i, value: "farmer" },
  { pattern: /vidyarthi|chhatra|student|padhai|padhna|college|university|school/i, value: "student" },
  { pattern: /majdoor|mazdoor|shramik|kamgar|worker|labour|labourer|mistri/i, value: "worker" },
  { pattern: /vyapari|dukandaar|business|startup|msme|entrepreneur/i, value: "startup" },
  { pattern: /berozgaar|unemployed|naukri nahi|rojgaar nahi/i, value: "unemployed" },
  { pattern: /grihini|housewife|homemaker|gharelu/i, value: "housewife" },
];

const WIDOW_OCCUPATION_PATTERNS = [
  { pattern: /widow|patavya|bereaved|husband died|husband dead|my husband is dead|widow pension/i, value: "widow" },
];

const HINDI_STATE_PATTERNS = [
  { pattern: /\bup\b|u\.p\.|uttar\s*pradesh|utar\s*pradesh/i, value: "uttarpradesh" },
  { pattern: /\bmp\b|m\.p\.|madhya\s*pradesh/i, value: "madhyapradesh" },
  { pattern: /delhi|dilli/i, value: "delhi" },
  { pattern: /\bmh\b|maharashtra/i, value: "maharashtra" },
  { pattern: /rajasthan|\braj\b/i, value: "rajasthan" },
  { pattern: /\bbr\b|bihar/i, value: "bihar" },
  { pattern: /west\s*bengal|bengal|\bwb\b|paschim\s*banga/i, value: "westbengal" },
  { pattern: /\bpb\b|punjab/i, value: "punjab" },
  { pattern: /\bhr\b|haryana/i, value: "haryana" },
  { pattern: /\bgj\b|gujarat/i, value: "gujarat" },
  { pattern: /\bkar\b|karnataka/i, value: "karnataka" },
  { pattern: /\btn\b|tamil\s*nadu/i, value: "tamilnadu" },
  { pattern: /\btg\b|telangana/i, value: "telangana" },
  { pattern: /\bap\b|andhra\s*pradesh/i, value: "andhrapradesh" },
  { pattern: /\buk\b|uttarakhand/i, value: "uttarakhand" },
  { pattern: /\bcg\b|chhattisgarh/i, value: "chhattisgarh" },
  { pattern: /odisha|orissa/i, value: "odisha" },
  { pattern: /assam/i, value: "assam" },
  { pattern: /\bjk\b|jammu|kashmir/i, value: "jammukashmir" },
  { pattern: /\bjh\b|jharkhand/i, value: "jharkhand" },
  { pattern: /\bhp\b|himachal/i, value: "himachalpradesh" },
  { pattern: /kerala/i, value: "kerala" },
  { pattern: /goa/i, value: "goa" },
];

const HINDI_INTENT_PATTERNS = [
  { pattern: /kisan|kisaan|krishak|kheti|fasal|khet|annadata/i, value: "farmer" },
  { pattern: /scholarship|chatravritti|padhai.*madad|madad.*padhai/i, value: "scholarship" },
  { pattern: /ilaaj|treatment|dawai|hospital|dawa|bimari/i, value: "treatment" },
  { pattern: /loan|rin|karz|paisa\s*chahiye.*ilaaj/i, value: "loan" },
  { pattern: /naukri|rojgaar|job|employment|berozgaar/i, value: "job" },
  { pattern: /business|startup|dukaan|vyapar/i, value: "startup-funding" },
];

const applyKeywordFallback = (message, profile) => {
  const patched = { ...profile };
  let changed = false;

  for (const { pattern, value } of WIDOW_OCCUPATION_PATTERNS) {
    if (pattern.test(message)) {
      patched.occupation = value;
      changed = true;
      console.log("[Widow Override] Occupation overridden to 'widow' from message");
      break;
    }
  }

  if (patched.occupation === "unknown") {
    for (const { pattern, value } of HINDI_OCCUPATION_PATTERNS) {
      if (pattern.test(message)) {
        patched.occupation = value;
        changed = true;
        break;
      }
    }
  }

  if (patched.state === "unknown") {
    for (const { pattern, value } of HINDI_STATE_PATTERNS) {
      if (pattern.test(message)) {
        patched.state = value;
        changed = true;
        break;
      }
    }
  }

  if (patched.primaryIntent === "unknown") {
    for (const { pattern, value } of HINDI_INTENT_PATTERNS) {
      if (pattern.test(message)) {
        patched.primaryIntent = value;
        patched.intentConfidence = Math.max(patched.intentConfidence, 0.70);
        changed = true;
        break;
      }
    }
  }

  if (changed) {
    console.log("[Keyword Fallback] Patched profile fields from raw message");
  }

  return patched;
};


const INTENT_SCORE_CATEGORIES = {
  treatment:        ["Health & Wellness", "Medical"],
  medical:          ["Health & Wellness", "Medical"],
  scholarship:      ["Education & Learning", "Scholarship"],
  student:          ["Education & Learning", "Scholarship"],
  loan:             ["Banking,Financial Services and Insurance", "Loan"],
  "startup-funding":["Business & Entrepreneurship", "Startup"],
  business:         ["Business & Entrepreneurship"],
  farmer:           ["Agriculture, Rural & Environment"],
  job:              ["Skills & Employment", "Employment"],
  unemployed:       ["Skills & Employment", "Employment"],
  maternity:        ["Health & Wellness", "Women and Child"],
  disability:       ["Social welfare & Empowerment", "Disability"],
  marriage:         ["Social welfare & Empowerment", "Marriage"],
  death:            ["Social welfare & Empowerment"],
  "widow-support":  ["Social welfare & Empowerment", "Women and Child"],
};


const INTENT_OCCUPATION_MAP = {
  farmer:           "farmer",
  student:          "student",
  "startup-funding":"startup",
  business:         "startup",
  unemployed:       "unemployed",
  "widow-support":  "widow",
};


const userMentionsDisability = (message = "") =>
  /disab|handicap|divyang|pwd|differently.?abled|blind|deaf|physically.?challenged|mental.?retard|cerebral|autism/i.test(message);


const userMentionsWidow = (message = "") =>
  /widow|patavya|bereaved|husband died|husband dead|my husband is dead|widow pension/i.test(message);


const userMentionsPregnancy = (message = "") =>
  /pregnant|maternity|pregnancy|pregn|magicare|agb|pgnancy|lgd|dada|childbirth|delivery|antenatal|neonate/i.test(message);


const educationLevelConflicts = (schemeEduLevels = [], userEduLevel = "") => {
  if (!userEduLevel || userEduLevel === "unknown" || userEduLevel === "all")
    return false;
  if (schemeEduLevels.length === 0 || schemeEduLevels.includes("all"))
    return false;

  if (
    userEduLevel === "higher_education" &&
    schemeEduLevels.every((l) => l === "school")
  )
    return true;

  if (
    userEduLevel === "school" &&
    schemeEduLevels.every((l) => l === "higher_education")
  )
    return true;

  return false;
};


// ✅ FIXED: All 3 issues resolved
const scoreScheme = (scheme, profile, queryEmbedding, rawMessage) => {
  const {
    primaryIntent,
    secondaryIntents = [],
    emotion,
    intentConfidence = 0,
    emotionConfidence = 0,
    occupation,
    state,
    educationLevel,
    casteCategory,
    income,
    age,
    gender,
  } = profile;


  let score = cosineSimilarity(queryEmbedding, scheme.embedding) * 100;


  // ✅ FIXED: Age hard reject (OLD AGE detection add)
  if (age !== null) {
    if (scheme.minAge !== null && age < scheme.minAge) {
      return -1000;
    }
    if (scheme.maxAge !== null && age > scheme.maxAge) {
      return -1000;
    }
    
    // ✅ NEW: Old Age scheme name/detection即使没有DB age limit
    const schemeNameLower = (scheme.name || "").toLowerCase();
    const schemeDescLower = (scheme.description || "").toLowerCase();
    
    if (
      (/old age|senior citizen|senior citizen pension/i.test(schemeNameLower) ||
       /old age|senior citizen|60 years|60+ years/i.test(schemeDescLower)) &&
      age < 50
    ) {
      return -1000;
    }
  }


  // Pregnancy/Maternity hard rejection
  if (!userMentionsPregnancy(rawMessage) && occupation !== "widow") {
    const schemeNameLower = (scheme.name || "").toLowerCase();
    const schemeDescLower = (scheme.description || "").toLowerCase();
    
    if (
      /pregnant|maternity|pregnancy|pregn|delivery|antenatal|neonate|matritva|suman/i.test(schemeNameLower) ||
      /pregnant|maternity|pregnancy|pregn|delivery|antenatal|neonate/i.test(schemeDescLower)
    ) {
      return -1000;
    }
  }


  // Child-specific hard rejection
  if (occupation !== "widow") {
    const schemeNameLower = (scheme.name || "").toLowerCase();
    const schemeDescLower = (scheme.description || "").toLowerCase();
    
    if (
      /girl child|ladli|child|bal|bach|juvenile|minor|kid|infant|newborn/i.test(schemeNameLower) ||
      /girl child|ladli|child|bal|bach|juvenile|minor|kid|infant|newborn/i.test(schemeDescLower)
    ) {
      if (scheme.maxAge !== null && scheme.maxAge < 18) {
        return -1000;
      }
    }
  }


  // Startup/Company hard rejection
  if (occupation !== "startup" && occupation !== "widow") {
    const schemeNameLower = (scheme.name || "").toLowerCase();
    const schemeDescLower = (scheme.description || "").toLowerCase();
    
    if (
      /startup|company|corporation|business|enterprise|incubator/i.test(schemeNameLower) &&
      (scheme.allowedOccupations.includes("startup") || !scheme.allowedOccupations.includes("all"))
    ) {
      return -1000;
    }
  }


  // Scientist/Technology hard rejection
  if (occupation !== "student" && occupation !== "worker") {
    const schemeNameLower = (scheme.name || "").toLowerCase();
    const schemeDescLower = (scheme.description || "").toLowerCase();
    
    if (
      /scientist|telecom|technology|tech|broadband|mobile service/i.test(schemeNameLower) ||
      /scientist|telecom|technology|tech|broadband|mobile service/i.test(schemeDescLower)
    ) {
      return -1000;
    }
  }


  // ✅ FIXED: Widow boost + effectiveGender
  const effectiveGender = gender === "unknown" && occupation === "widow" ? "female" : gender;


  if (occupation === "widow" || userMentionsWidow(rawMessage)) {
    const schemeNameLower = (scheme.name || "").toLowerCase();
    const schemeDescLower = (scheme.description || "").toLowerCase();
    const schemeTagsLower = (scheme.tags || []).map(t => t.toLowerCase());
    
    const isWidowScheme =
      /widow|patavya|bereaved|deceased husband|widow pension/i.test(schemeNameLower) ||
      /widow|patavya|bereaved|widow pension/i.test(schemeDescLower) ||
      /widow|patavya|bereaved/i.test(schemeTagsLower.join(" "));
    
    if (isWidowScheme) {
      score += 50;
    }
  }


  if (primaryIntent && primaryIntent !== "unknown") {
    const intentCategories = INTENT_SCORE_CATEGORIES[primaryIntent] || [];
    const schemeCategory = scheme.category || "";

    if (
      intentCategories.some((c) =>
        schemeCategory.toLowerCase().includes(c.toLowerCase())
      )
    ) {
      score += 10 * intentConfidence;
    }

    const intentOccupation = INTENT_OCCUPATION_MAP[primaryIntent];
    if (
      intentOccupation &&
      (scheme.allowedOccupations.includes(intentOccupation) ||
        scheme.allowedOccupations.includes("all"))
    ) {
      score += 5 * intentConfidence;
    }

    if (
      (primaryIntent === "scholarship" || primaryIntent === "student") &&
      scheme.isScholarship
    ) {
      score += 4 * intentConfidence;
    }

    for (const si of secondaryIntents) {
      const siCats = INTENT_SCORE_CATEGORIES[si] || [];
      if (
        siCats.some((c) =>
          schemeCategory.toLowerCase().includes(c.toLowerCase())
        )
      ) {
        score += 5;
        break;
      }
    }
  }


  if (occupation && occupation !== "unknown") {
    if (
      scheme.allowedOccupations.includes(occupation) ||
      scheme.allowedOccupations.includes("all")
    ) {
      score += 5;
    } else if (
      !scheme.allowedOccupations.includes("all") &&
      scheme.allowedOccupations.length > 0 &&
      !scheme.allowedOccupations.includes(occupation)
    ) {
      score -= 10;
    }
  }


  if (educationLevel && educationLevel !== "unknown") {
    if (
      scheme.allowedEducationLevels.includes(educationLevel) ||
      scheme.allowedEducationLevels.includes("all")
    ) {
      score += 5;
    } else if (educationLevelConflicts(scheme.allowedEducationLevels, educationLevel)) {
      score -= 10;
    }
  }


  if (casteCategory && casteCategory !== "unknown") {
    if (scheme.allowedCategories.includes(casteCategory)) {
      score += 5;
    }
  }


  if (state && state !== "unknown") {
    const normalizedState = normalizeState(state);
    const schemeStates = (scheme.allowedStates || []).map((s) =>
      s.toLowerCase().replace(/\s/g, "")
    );
    const schemeStateScalar = (scheme.state || "").toLowerCase().replace(/\s/g, "");

    const isNational =
      schemeStates.length === 0 ||
      schemeStates.includes("all") ||
      schemeStateScalar === "allindia" ||
      schemeStateScalar === "all";

    const isStateMatch = schemeStates.includes(normalizedState);

    if (isNational || isStateMatch) {
      score += 4;
    } else {
      score -= 5;
    }
  }


  // ✅ FIXED: Use effectiveGender
  if (effectiveGender === "female" && scheme.isFemaleOnly) {
    score += 5;
  }
  if (scheme.isFemaleOnly && effectiveGender !== "female") {
    score -= 20;
  }
  if (
    effectiveGender &&
    effectiveGender !== "unknown" &&
    effectiveGender !== "other" &&
    scheme.allowedGenders.length > 0 &&
    !scheme.allowedGenders.includes(effectiveGender) &&
    !scheme.allowedGenders.includes("all")
  ) {
    score -= 15;
  }


  const schemeHasDisabilityContext =
    (scheme.tags || []).some((t) =>
      /disab|pwd|differently.?abled|handicap|divyang/i.test(t)
    ) ||
    /disab|pwd|differently.?abled|handicap|divyang/i.test(scheme.description || "") ||
    /disab|pwd|differently.?abled|handicap|divyang/i.test(scheme.name || "");

  if (schemeHasDisabilityContext && !userMentionsDisability(rawMessage)) {
    score -= 25;
  }


  if (income !== null && scheme.maxIncome !== null) {
    if (income > scheme.maxIncome) {
      score -= 20;
    }
  }


  if (emotion && emotion !== "unknown" && emotionConfidence > 0.6) {
    if (["urgent", "desperate", "worried", "anxious"].includes(emotion)) {
      score += 3 * emotionConfidence;
    }
  }


  return score;
};


export const extractProfile = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "message is required" });
    }

    const trimmedMessage = message.trim();

    let profile = await extractUserProfile(trimmedMessage);

    profile = applyKeywordFallback(trimmedMessage, profile);

    const {
      primaryIntent,
      secondaryIntents = [],
      emotion,
      intentConfidence = 0.5,
      occupation,
      state,
      income,
      age,
      gender,
      casteCategory,
      educationLevel,
    } = profile;

    const queryParts = [
      trimmedMessage,
      occupation !== "unknown" ? occupation : "",
      educationLevel !== "unknown" ? educationLevel : "",
      casteCategory !== "unknown" ? casteCategory : "",
      state !== "unknown" ? state : "",
      primaryIntent !== "unknown" ? primaryIntent : "",
      ...secondaryIntents,
    ].filter(Boolean);

    const queryText = queryParts.join(" ");

    const extractor = await getExtractor();
    const output = await extractor(queryText, {
      pooling: "mean",
      normalize: true,
    });
    const queryEmbedding = Array.from(output.data);

    const dbWhere = {
      isActive: true,
      AND: [],
    };

    if (
      gender &&
      gender !== "unknown" &&
      gender !== "female"
    ) {
      dbWhere.AND.push({ isFemaleOnly: false });
    }

    if (income !== null) {
      dbWhere.AND.push({
        OR: [{ maxIncome: null }, { maxIncome: { gte: income } }],
      });
    }

    if (state && state !== "unknown") {
      const normalizedState = normalizeState(state);
      dbWhere.AND.push({
        OR: [
          { allowedStates: { isEmpty: true } },
          { allowedStates: { has: "all" } },
          { allowedStates: { has: normalizedState } },
        ],
      });
    }

    if (
      occupation &&
      occupation !== "unknown" &&
      occupation !== "all"
    ) {
      dbWhere.AND.push({
        OR: [
          { allowedOccupations: { has: occupation } },
          { allowedOccupations: { has: "all" } },
        ],
      });
    }

    if (casteCategory && casteCategory !== "unknown") {
      dbWhere.AND.push({
        OR: [
          { allowedCategories: { has: casteCategory } },
          { allowedCategories: { has: "general" } },
        ],
      });
    }

    if (educationLevel && educationLevel !== "unknown") {
      dbWhere.AND.push({
        OR: [
          { allowedEducationLevels: { has: educationLevel } },
          { allowedEducationLevels: { has: "all" } },
        ],
      });
    }

    if (age !== null) {
      dbWhere.AND.push({
        OR: [{ minAge: null }, { minAge: { lte: age } }],
      });
      dbWhere.AND.push({
        OR: [{ maxAge: null }, { maxAge: { gte: age } }],
      });
    }

    if (dbWhere.AND.length === 0) delete dbWhere.AND;

    const candidates = await prisma.scheme.findMany({
      where: dbWhere,
      select: {
        id: true,
        name: true,
        description: true,
        benefits: true,
        eligibility: true,
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
        isScholarship: true,
        isFemaleOnly: true,
        applicationLink: true,
        sourceUrl: true,
        tags: true,
        embedding: true,
        externalId: true,
        sourceId: true,
      },
      take: 3000,
    });

    if (candidates.length === 0) {
      return res.json({
        profile,
        schemes: [],
        meta: { total: 0, queryText, filtersApplied: Object.keys(dbWhere) },
      });
    }

    const threshold = 25;

    const scored = candidates
      .map((scheme) => ({
        ...scheme,
        _score: scoreScheme(scheme, profile, queryEmbedding, trimmedMessage),
      }))
      .filter((s) => s._score >= threshold)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    const results = scored.map(({ embedding: _emb, _score, ...rest }) => ({
      ...rest,
      relevanceScore: Math.round(_score),
    }));

    return res.json({
      profile: {
        ...profile,
        _debug: {
          primaryIntent,
          intentConfidence,
          emotion,
          occupation,
          gender,
          effectiveGender: gender === "unknown" && occupation === "widow" ? "female" : gender,
          queryText,
          candidatesBeforeScoring: candidates.length,
          candidatesAfterScoring: results.length,
          threshold,
          isWidow: occupation === "widow" || userMentionsWidow(trimmedMessage),
        },
      },
      schemes: results,
      meta: {
        total: results.length,
        candidatesEvaluated: candidates.length,
      },
    });
  } catch (err) {
    console.error("[AI Controller Error]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};