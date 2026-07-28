/**
 * scoreConstants.js
 *
 * All numeric thresholds and score adjustments for the recommendation engine.
 */
export const SCORE = {
  // ── Base threshold ─────────────────────────────────────────────────────────
  DEFAULT_THRESHOLD: 45,

  // ── Semantic similarity (cosine * 100 forms the base) ─────────────────────
  SEMANTIC_WEIGHT: 100,

  // ── Keyword overlap layer ─────────────────────────────────────────────────
  KEYWORD_OVERLAP_PER_HIT: 2.5,
  KEYWORD_OVERLAP_MAX: 20,

  // ── State scoring ─────────────────────────────────────────────────────────
  STATE_MATCH: 8,
  STATE_MISMATCH: -12,
  STATE_UNKNOWN_NON_NATIONAL_PENALTY: -15,

  // ── Intent scoring ────────────────────────────────────────────────────────
  INTENT_MATCH: 12,
  HIGH_PRIORITY_INTENT: 26,
  INTENT_CATEGORY_MATCH_MULTIPLIER: 1.3,

  // ── Occupation scoring ────────────────────────────────────────────────────
  OCCUPATION_MATCH: 7,
  OCCUPATION_MISMATCH: -12,
  OCCUPATION_KEYWORD_BOOST: 8,

  // ── Gender scoring ────────────────────────────────────────────────────────
  GENDER_MISMATCH: -15,
  FEMALE_BONUS: 8,

  // ── Income ────────────────────────────────────────────────────────────────
  INCOME_PENALTY: -20,
  INCOME_MATCH_BOOST: 5,

  // ── Emotion ───────────────────────────────────────────────────────────────
  EMOTION_BONUS: 4,

  // ── Age ───────────────────────────────────────────────────────────────────
  AGE_MISMATCH: -1000,

  // ── Medical intent ────────────────────────────────────────────────────────
  MEDICAL_SEMANTIC_THRESHOLD: 50,
  HEALTH_INSURANCE_BOOST: 12,

  // ── Widow scoring ─────────────────────────────────────────────────────────
  WIDOW_BONUS: 60,
  WIDOW_PENALTY: -40,

  // ── Caste / Category ──────────────────────────────────────────────────────
  CASTE_MATCH: 6,
  CATEGORY_MISMATCH: -25,
  RESERVED_CATEGORY_PENALTY: -25,

  // ── Education ─────────────────────────────────────────────────────────────
  EDUCATION_MATCH: 6,
  EDUCATION_CONFLICT: -35,

  // ── Finance × Health cross-penalty ────────────────────────────────────────
  FINANCIAL_MISMATCH: -10,
  HEALTH_FINANCE_PENALTY: -18,

  // ── Disability ────────────────────────────────────────────────────────────
  DISABILITY_REJECT: -1000,

  // ── Hard rejects ─────────────────────────────────────────────────────────
  SPECIAL_REJECT: -1000,
  STARTUP_NON_MATCH_PENALTY: -1000,

  // ── Misc boosts ───────────────────────────────────────────────────────────
  DISEASE_KEYWORD_BOOST: 35,
  UNRELATED_CATEGORY_PENALTY: -30,

  // ── Generic scheme penalty ────────────────────────────────────────────────
  GENERIC_SCHEME_PENALTY: -15,

  // ── Scholarship ───────────────────────────────────────────────────────────
  SCHOLARSHIP_EXACT_MATCH_BOOST: 12,

  // ── Name / benefit keyword boost ─────────────────────────────────────────
  NAME_KEYWORD_BOOST: 10,
  BENEFIT_KEYWORD_BOOST: 5,

  // ── Per-intent thresholds ─────────────────────────────────────────────────
  THRESHOLD_MAP: {
    treatment:          34,
    medical:            34,
    "widow-support":    38,
    death:              38,
    disability:         38,
    maternity:          60,
    loan:               48,
    scholarship:        46,
    "startup-funding":  48,
    farmer:             43,
    job:                46,
    unemployed:         44,
    housing:            40,
    sanitation:         36,
    pension:            40,
    marriage:           40,
    default:            45,
  },

  // ── Intent → allowed scheme categories ────────────────────────────────────
  INTENT_ALLOWED_CATEGORIES: {
    farmer: new Set([
      "agriculture, rural & environment",
      "banking,financial services and insurance",
      "social welfare & empowerment",
      "skills & employment",
    ]),
    student: new Set([
      "education & learning",
      "scholarship",
      "banking,financial services and insurance",
      "social welfare & empowerment",
      "skills & employment",
    ]),
    scholarship: new Set([
      "education & learning",
      "scholarship",
      "banking,financial services and insurance",
      "social welfare & empowerment",
    ]),
    business: new Set([
      "business & entrepreneurship",
      "banking,financial services and insurance",
      "skills & employment",
    ]),
    "startup-funding": new Set([
      "business & entrepreneurship",
      "banking,financial services and insurance",
      "skills & employment",
    ]),
    job: new Set([
      "skills & employment",
      "business & entrepreneurship",
      "banking,financial services and insurance",
      "social welfare & empowerment",
    ]),
    unemployed: new Set([
      "skills & employment",
      "social welfare & empowerment",
      "banking,financial services and insurance",
      "business & entrepreneurship",
    ]),
    "widow-support": new Set([
      "social welfare & empowerment",
      "banking,financial services and insurance",
      "health & wellness",
      "women and child",
    ]),
    maternity: new Set([
      "health & wellness",
      "women and child",
      "social welfare & empowerment",
    ]),
    disability: new Set([
      "social welfare & empowerment",
      "health & wellness",
      "banking,financial services and insurance",
      "skills & employment",
    ]),
    treatment: new Set([
      "health & wellness",
      "medical",
      "banking,financial services and insurance",
      "social welfare & empowerment",
    ]),
    medical: new Set([
      "health & wellness",
      "medical",
      "banking,financial services and insurance",
      "social welfare & empowerment",
    ]),
    loan: new Set([
      "banking,financial services and insurance",
      "skills & employment",
      "business & entrepreneurship",
      "education & learning",
      "agriculture, rural & environment",
      "social welfare & empowerment",
    ]),
    housing: new Set([
      "social welfare & empowerment",
      "banking,financial services and insurance",
      "urban development",
      "rural development",
    ]),
    sanitation: new Set([
      "social welfare & empowerment",
      "health & wellness",
      "urban development",
      "rural development",
    ]),
    pension: new Set([
      "social welfare & empowerment",
      "banking,financial services and insurance",
    ]),
    marriage: new Set([
      "social welfare & empowerment",
      "women and child",
      "banking,financial services and insurance",
    ]),
    death: new Set([
      "social welfare & empowerment",
      "banking,financial services and insurance",
    ]),
  },
};