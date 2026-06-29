/**
 * scoreConstants.js
 *
 * All numeric thresholds and score adjustments for the recommendation engine.
 *
 * IMPROVEMENT LOG:
 * - Added KEYWORD_OVERLAP_WEIGHT for new keyword-overlap scoring layer
 * - Added per-intent thresholds for housing, sanitation, pension, marriage, death
 * - Expanded INTENT_ALLOWED_CATEGORIES with new intents
 * - Added OCCUPATION_KEYWORD_BOOST for strong occupation-keyword alignment
 * - Added STATE_SPECIFIC_BOOST for state-scheme alignment
 * - Tightened WIDOW and DISABILITY thresholds (these are high-stakes, show fewer but better)
 * - Added HEALTH_INSURANCE_BOOST for insurance schemes in medical intent
 */

export const SCORE = {
  // ── Base threshold ─────────────────────────────────────────────────────────
  DEFAULT_THRESHOLD: 45,

  // ── Semantic similarity (cosine * 100 forms the base) ─────────────────────
  SEMANTIC_WEIGHT: 100,

  // ── Keyword overlap layer (new) ────────────────────────────────────────────
  // Each matching keyword from scheme text vs user query adds this to score
  KEYWORD_OVERLAP_PER_HIT: 2.5,
  KEYWORD_OVERLAP_MAX: 20,          // Cap so one very-specific query can't dominate

  // ── State scoring ──────────────────────────────────────────────────────────
  STATE_MATCH: 6,                   // Raised from 4 — state is very important in India
  STATE_MISMATCH: -8,               // Raised penalty — wrong state is a big deal
  STATE_UNKNOWN_NON_NATIONAL_PENALTY: -12,

  // ── Intent scoring ─────────────────────────────────────────────────────────
  INTENT_MATCH: 10,
  HIGH_PRIORITY_INTENT: 24,         // Raised from 22
  INTENT_CATEGORY_MATCH_MULTIPLIER: 1.2,  // Extra boost when category+intent align perfectly

  // ── Occupation scoring ─────────────────────────────────────────────────────
  OCCUPATION_MATCH: 7,              // Raised from 5
  OCCUPATION_MISMATCH: -12,         // Raised from -10
  OCCUPATION_KEYWORD_BOOST: 8,      // NEW: scheme text strongly matches user occupation keyword

  // ── Gender scoring ─────────────────────────────────────────────────────────
  GENDER_MISMATCH: -15,
  FEMALE_BONUS: 7,                  // Raised from 5 — female-specific schemes are very relevant

  // ── Income ────────────────────────────────────────────────────────────────
  INCOME_PENALTY: -20,
  INCOME_MATCH_BOOST: 5,            // NEW: user income is well within limit → slight boost

  // ── Emotion ───────────────────────────────────────────────────────────────
  EMOTION_BONUS: 4,                 // Raised from 3

  // ── Age ───────────────────────────────────────────────────────────────────
  AGE_MISMATCH: -1000,              // Hard reject

  // ── Medical intent ────────────────────────────────────────────────────────
  MEDICAL_SEMANTIC_THRESHOLD: 50,   // Lowered slightly from 52 — catch more health schemes
  HEALTH_INSURANCE_BOOST: 12,       // NEW: PMJAY/Ayushman type schemes for medical intent

  // ── Widow scoring ─────────────────────────────────────────────────────────
  WIDOW_BONUS: 55,                  // Raised from 50 — widow schemes must bubble to top
  WIDOW_PENALTY: -35,               // Raised from -30 — non-widows must not see widow schemes

  // ── Caste / Category ──────────────────────────────────────────────────────
  CASTE_MATCH: 6,                   // Raised from 5
  CATEGORY_MISMATCH: -22,
  RESERVED_CATEGORY_PENALTY: -22,   // Raised from -20

  // ── Education ─────────────────────────────────────────────────────────────
  EDUCATION_MATCH: 6,               // Raised from 5
  EDUCATION_CONFLICT: -30,

  // ── Finance × Health cross-penalty ────────────────────────────────────────
  FINANCIAL_MISMATCH: -8,
  HEALTH_FINANCE_PENALTY: -15,

  // ── Disability ────────────────────────────────────────────────────────────
  DISABILITY_REJECT: -1000,

  // ── Hard rejects (used as sentinel return values) ─────────────────────────
  SPECIAL_REJECT: -1000,
  STARTUP_NON_MATCH_PENALTY: -1000,

  // ── Misc boosts ───────────────────────────────────────────────────────────
  DISEASE_KEYWORD_BOOST: 32,        // Raised from 30 — disease-specific schemes must rank high
  UNRELATED_CATEGORY_PENALTY: -28,  // Raised from -25

  // ── Scholarship ───────────────────────────────────────────────────────────
  SCHOLARSHIP_EXACT_MATCH_BOOST: 10, // NEW: scheme.isScholarship + scholarship intent

  // ── Name-level keyword match ───────────────────────────────────────────────
  NAME_KEYWORD_BOOST: 8,            // NEW: user query keyword found in scheme NAME (high signal)

  // ── Benefit text match ────────────────────────────────────────────────────
  BENEFIT_KEYWORD_BOOST: 4,         // NEW: keyword found in scheme benefits text

  // ── Per-intent thresholds ─────────────────────────────────────────────────
  THRESHOLD_MAP: {
    treatment:         34,   // Lowered slightly — catch more health schemes
    medical:           34,
    "widow-support":   38,
    death:             38,
    disability:        38,
    maternity:         38,
    loan:              48,
    scholarship:       46,
    "startup-funding": 48,
    farmer:            43,   // Lowered — agriculture schemes have sparse text
    job:               46,
    unemployed:        44,
    housing:           40,
    sanitation:        36,
    pension:           40,
    marriage:          40,
    default:           45,
  },

  // ── Intent → allowed scheme categories ────────────────────────────────────
  // When intentConfidence > 0.6, schemes outside these categories are rejected.
  // Using lowercase to match schemeCatLower comparisons.
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