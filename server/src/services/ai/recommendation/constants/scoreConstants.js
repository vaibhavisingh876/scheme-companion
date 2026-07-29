/**
 * scoreConstants.js
 *
 * All numeric thresholds and score adjustments for the recommendation engine.
 */
export const SCORE = {
  DEFAULT_THRESHOLD: 45,

  SEMANTIC_WEIGHT: 100,

  KEYWORD_OVERLAP_PER_HIT: 2.5,
  KEYWORD_OVERLAP_MAX: 20,

  STATE_MATCH: 8,
  STATE_MISMATCH: -12,
  STATE_UNKNOWN_NON_NATIONAL_PENALTY: -15,

  INTENT_MATCH: 12,
  HIGH_PRIORITY_INTENT: 26,
  INTENT_CATEGORY_MATCH_MULTIPLIER: 1.3,

  OCCUPATION_MATCH: 7,
  OCCUPATION_MISMATCH: -12,
  OCCUPATION_KEYWORD_BOOST: 8,

  GENDER_MISMATCH: -15,
  FEMALE_BONUS: 8,

  INCOME_PENALTY: -20,
  INCOME_MATCH_BOOST: 5,

  EMOTION_BONUS: 4,

  AGE_MISMATCH: -1000,

  MEDICAL_SEMANTIC_THRESHOLD: 50,
  HEALTH_INSURANCE_BOOST: 12,

  WIDOW_BONUS: 60,
  WIDOW_PENALTY: -100,

  CASTE_MATCH: 6,
  CATEGORY_MISMATCH: -25,

  RESERVED_CATEGORY_PENALTY: -100,

  EDUCATION_MATCH: 6,
  EDUCATION_CONFLICT: -100,

  FINANCIAL_MISMATCH: -10,
  HEALTH_FINANCE_PENALTY: -18,

  DISABILITY_REJECT: -1000,

  SPECIAL_REJECT: -1000,
  STARTUP_NON_MATCH_PENALTY: -1000,

  DISEASE_KEYWORD_BOOST: 35,
  UNRELATED_CATEGORY_PENALTY: -30,

  // 🔧 Was -15. Real traffic showed this wasn't strong enough: generic
  // savings/insurance products (Kisan Vikas Patra, PMJJBY, a community-toilet
  // loan scheme) were outranking on-topic results because their semantic
  // score alone (40-90) easily absorbed a -15 penalty. Bumped to make it a
  // near-hard-reject for generic financial products when the user has a
  // specific, high-confidence intent.
  GENERIC_SCHEME_PENALTY: -45,

  SCHOLARSHIP_EXACT_MATCH_BOOST: 12,

  NAME_KEYWORD_BOOST: 10,
  BENEFIT_KEYWORD_BOOST: 5,

  THRESHOLD_MAP: {
    treatment:          34,
    medical:            34,
    "widow-support":    38,
    death:              38,
    disability:         38,
    maternity:          60,
    loan:               48,
    scholarship:        50,  // increased from 46 to filter more
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