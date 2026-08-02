// scoringEngine.js
import {
  SCORE,
  INTENT_CATEGORY_MAP,
  INTENT_TAG_MAP,
} from "./recommendation/constants/scoreConstants.js";

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

export const scoreScheme = (scheme, profile, queryEmbedding, rawMessage) => {
  const reasons = [];
  let hardConflicts = 0;
  let score = 0;

  // Semantic similarity
  if (Array.isArray(scheme.embedding) && scheme.embedding.length === queryEmbedding.length) {
    const sim = cosineSimilarity(queryEmbedding, scheme.embedding);
    score = sim * 70;
    if (!Number.isNaN(score) && score > 0) reasons.push("Semantic similarity contributes");
  } else {
    reasons.push("No embedding available, semantic score zero");
  }

  // ===== HARD ELIGIBILITY CHECKS =====
  if (profile.age !== null && profile.age !== undefined) {
    if (scheme.minAge !== null && profile.age < scheme.minAge) {
      hardConflicts += 1;
      reasons.push(`Not recommended: age ${profile.age} below minimum ${scheme.minAge}`);
    }
    if (scheme.maxAge !== null && profile.age > scheme.maxAge) {
      hardConflicts += 1;
      reasons.push(`Not recommended: age ${profile.age} above maximum ${scheme.maxAge}`);
    }
  }

  if (profile.income !== null && profile.income !== undefined) {
    if (scheme.maxIncome !== null && profile.income > scheme.maxIncome) {
      hardConflicts += 1;
      reasons.push(`Not recommended: income ${profile.income} exceeds limit ${scheme.maxIncome}`);
    }
    if (scheme.minIncome !== null && scheme.minIncome !== undefined && profile.income < scheme.minIncome) {
      hardConflicts += 1;
      reasons.push(`Not recommended: income ${profile.income} below minimum ${scheme.minIncome}`);
    }
  }

  const userGender = (profile.gender || "").toLowerCase().trim();
  if (scheme.isFemaleOnly === true && userGender !== "female") {
    hardConflicts += 1;
    reasons.push(`Not recommended: scheme is female‑only, user is ${userGender}`);
  }

  const allowedGenders = (scheme.allowedGenders || []).map(g => String(g).toLowerCase().trim());
  if (
    allowedGenders.length > 0 &&
    !allowedGenders.includes("all") &&
    userGender &&
    userGender !== "unknown" &&
    !allowedGenders.includes(userGender)
  ) {
    hardConflicts += 1;
    reasons.push(`Not recommended: gender ${userGender} not allowed (allowed: ${allowedGenders.join(', ')})`);
  }

  if (profile.educationLevel && profile.educationLevel !== "unknown") {
    const eduLevels = (scheme.allowedEducationLevels || []).map(e => String(e).toLowerCase().trim());
    if (eduLevels.length > 0 && !eduLevels.includes("all") && !eduLevels.includes(profile.educationLevel)) {
      hardConflicts += 1;
      reasons.push(`Not recommended: education level ${profile.educationLevel} not allowed (allowed: ${eduLevels.join(', ')})`);
    }
  }

  const userCaste = (profile.casteCategory || "").toLowerCase().trim();
  const effectiveCaste = (userCaste === "unknown" || userCaste === "") ? "general" : userCaste;
  const allowedCastes = (scheme.allowedCategories || []).map(c => String(c).toLowerCase().trim());

  if (allowedCastes.length > 0 && !allowedCastes.includes("all") && !allowedCastes.includes(effectiveCaste)) {
    hardConflicts += 1;
    reasons.push(`Not recommended: caste ${effectiveCaste} not allowed (allowed: ${allowedCastes.join(', ')})`);
  }

  // ===== SOFT TEXT PENALTIES =====
  const schemeText = [
    String(scheme.name || "").toLowerCase(),
    String(scheme.description || "").toLowerCase(),
    String(scheme.eligibility || "").toLowerCase(),
    ...(scheme.tags || []).map(t => String(t).toLowerCase()),
  ].join(" ");

  if (effectiveCaste === "general" && /\b(sc|st|obc|minority|scheduled caste|scheduled tribe|other backward class|backward class|dalit|adivasi|muslim|sikh|christian|jain|buddhist|parsi)\b/i.test(schemeText)) {
    score -= 30;
    reasons.push("Reserved‑category mention, penalty (-30)");
  }

  if (profile.educationLevel === "higher_education" && /\b(school|class|nursery|uniform|textbook|students of class|class \d|secondary|matric)\b/i.test(schemeText)) {
    score -= 30;
    reasons.push("School‑level mention, penalty (-30)");
  }

  // ===== INTENT BOOSTS FROM RAW MESSAGE =====
  if (rawMessage) {
    const msg = rawMessage.toLowerCase();
    if (/\bloan\b/.test(msg) || /\bcredit\b/.test(msg) || /\bfinancial assistance\b/.test(msg)) {
      if (/\bloan\b/.test(schemeText) || /\bcredit\b/.test(schemeText) || /\bfinancial assistance\b/.test(schemeText)) {
        score += 20;
        reasons.push("User mentioned loan, scheme has loan keywords (+20)");
      }
    }
    if (/\bbusiness\b/.test(msg) || /\bstartup\b/.test(msg) || /\bself[-\s]?employment\b/.test(msg) || /\bsmall business\b/.test(msg)) {
      if (/\bbusiness\b/.test(schemeText) || /\bstartup\b/.test(schemeText) || /\bself[-\s]?employment\b/.test(schemeText) || /\benterprise\b/.test(schemeText) || /\bmudra\b/.test(schemeText)) {
        score += 20;
        reasons.push("User mentioned business, scheme has business keywords (+20)");
      }
    }
    if (/\bjob\b/.test(msg) || /\bemployment\b/.test(msg) || /\bwork\b/.test(msg)) {
      if (/\bjob\b/.test(schemeText) || /\bemployment\b/.test(schemeText) || /\brojgaar\b/.test(schemeText) || /\bskill\b/.test(schemeText)) {
        score += 15;
        reasons.push("User mentioned job, scheme has job keywords (+15)");
      }
    }
  }

  // ===== METADATA BONUSES =====
  // Occupation
  if (profile.occupation && profile.occupation !== "unknown") {
    const userOcc = profile.occupation.toLowerCase().trim();
    const allowedOccs = (scheme.allowedOccupations || []).map(o => String(o).toLowerCase().trim());
    if (allowedOccs.length && !allowedOccs.includes("all")) {
      if (allowedOccs.includes(userOcc)) {
        score += SCORE.OCCUPATION_BONUS;
        reasons.push(`Occupation matches (+${SCORE.OCCUPATION_BONUS})`);
      } else {
        score -= 5;
        reasons.push(`Occupation mismatch (-5)`);
      }
    }
  }

  // Education bonus
  if (profile.educationLevel && profile.educationLevel !== "unknown") {
    const eduLevels = (scheme.allowedEducationLevels || []).map(e => String(e).toLowerCase().trim());
    if (eduLevels.length && !eduLevels.includes("all") && eduLevels.includes(profile.educationLevel)) {
      score += SCORE.EDUCATION_BONUS;
      reasons.push(`Education matches (+${SCORE.EDUCATION_BONUS})`);
    }
  }

  // State – strings normalized (spaces/punctuation stripped) so multi-word
  // states like "Arunachal Pradesh" compare correctly even if allowedStates
  // isn't populated. Strong penalty for mismatch (-40).
  if (profile.state && profile.state !== "unknown") {
    const normState = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const userState = normState(profile.state);
    const allowedStates = (scheme.allowedStates || []).map(normState);
    const schemeState = normState(scheme.state);
    const isNational = allowedStates.includes("all") || schemeState === "" || schemeState === "all" || schemeState === "india";
    if (!isNational) {
      if (allowedStates.includes(userState) || schemeState === userState) {
        score += SCORE.STATE_BONUS;
        reasons.push(`State matches (+${SCORE.STATE_BONUS})`);
      } else {
        score -= 40;
        reasons.push(`State mismatch (-40)`);
      }
    } else {
      reasons.push("Scheme is national, no state bonus");
    }
  }

  // Category (intent-based)
  const userIntent = profile.primaryIntent;
  if (userIntent && userIntent !== "unknown") {
    const intentCats = INTENT_CATEGORY_MAP[userIntent] || [];
    const schemeNormCat = normalizeCategory(scheme.category);
    const categoryMatched = intentCats.some(cat => normalizeCategory(cat) === schemeNormCat);
    if (categoryMatched) {
      score += SCORE.INTENT_BONUS;
      reasons.push(`Category matches (+${SCORE.INTENT_BONUS})`);
    } else {
      score -= 5;
      reasons.push("Category mismatch (-5)");
    }
  }

  // Intent keywords from tags/description
  if (userIntent && userIntent !== "unknown") {
    const intentTags = INTENT_TAG_MAP[userIntent] || [];
    const intentCats = INTENT_CATEGORY_MAP[userIntent] || [];
    const fullText = [
      String(scheme.name || "").toLowerCase(),
      String(scheme.description || "").toLowerCase(),
      String(scheme.benefits || "").toLowerCase(),
      String(scheme.eligibility || "").toLowerCase(),
      ...(scheme.tags || []).map(t => String(t).toLowerCase()),
      String(scheme.category || "").toLowerCase(),
    ].join(" ");
    const matched = intentTags.some(t => fullText.includes(t)) || intentCats.some(c => fullText.includes(c));
    if (matched) {
      score += SCORE.TAG_BONUS;
      reasons.push(`Intent keywords matched (+${SCORE.TAG_BONUS})`);
    }
  }

  // schemeFor
  if (scheme.schemeFor) {
    const schemeForNorm = String(scheme.schemeFor).toLowerCase().trim();
    const userOcc = (profile.occupation || "").toLowerCase().trim();
    const userIntentNorm = (profile.primaryIntent || "").toLowerCase().trim();
    if (schemeForNorm === userOcc || schemeForNorm === userIntentNorm) {
      score += 10;
      reasons.push("SchemeFor matches (+10)");
    }
  }

  if (hardConflicts > 0) {
    score = 0;
    reasons.push(`Rejected: ${hardConflicts} hard eligibility conflict(s)`);
  }

  return { score: Math.max(0, score), reasons, hardConflicts };
};