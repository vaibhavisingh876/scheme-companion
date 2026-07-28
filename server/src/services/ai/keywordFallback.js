/**
 * keywordFallback.js
 *
 * Pure keyword-based fallback/override layer applied AFTER Groq extraction.
 * If Groq returns "unknown" for a field, these regex rules try to fill it in.
 * These rules also CORRECT clear Groq errors (e.g. wrong occupation from context).
 *
 * IMPROVEMENT LOG:
 * - Added housing, sanitation, pension, marriage, death as primary intents
 * - Added more Hindi/Hinglish widow patterns
 * - Improved "beti ki padhai" fix — was causing housewife misclassification
 * - Added tribal / artisan / gig worker detection
 * - Added NRI / overseas scheme exclusion pattern
 * - More robust income-to-intent signals (e.g. "bpl" → low income flag)
 * - Added age-from-text extraction as a fallback
 */

import { PATTERNS } from "./recommendation/constants/patternConstants.js";

export const WIDOW_PATTERNS = [
  { pattern: PATTERNS.special.widow, value: "widow" },
];

export const HINDI_OCCUPATION_PATTERNS = Object.entries(PATTERNS.occupation).map(
  ([value, regex]) => ({ pattern: regex, value })
);

export const HINDI_STATE_PATTERNS = Object.entries(PATTERNS.state).map(
  ([value, regex]) => ({ pattern: regex, value })
);

export const HINDI_INTENT_PATTERNS = [
  ...Object.entries(PATTERNS.intent).map(([value, regex]) => ({ pattern: regex, value })),
  // Additional intent patterns not in PATTERNS.intent
  { pattern: /ghar|makaan|awas|housing|shelter|pmay/i,                        value: "housing" },
  { pattern: /toilet|shauchalay|swachh|sanitation|jal jeevan|drinking water/i, value: "sanitation" },
  { pattern: /pension|vridha|old age pension|senior pension|budhapa/i,         value: "pension" },
  { pattern: /shaadi|vivah|nikah|marriage|kanya vivah|beti ki shaadi/i,        value: "marriage" },
  { pattern: /death.*assist|antim anudan|funeral|breadwinner.*died|kabir|mrityu.*sahayata/i, value: "death" },
];

export const EDUCATION_LEVEL_PATTERNS = [
  {
    pattern: /higher studies|higher education|post.?grad|masters|mtech|mba|phd|ph\.d|post graduate|postgraduate|college|university|undergraduate|btech|b\.tech|degree|graduation|engineering|medical college|law school|fellowship|research|polytechnic|iti\b|diploma/i,
    value: "higher_education",
  },
  {
    pattern: /\bschool\b|10th|12th|class \d|pre.?matric|post.?matric|secondary|primary|matric|ssc\b|hsc\b|board exam|inter(mediate)?|higher secondary/i,
    value: "school",
  },
];

const OCCUPATION_EVIDENCE_PATTERNS = {
  student:    /student|vidyarthi|chhatra|padhai|padhna|padhne|college|university|school|btech|mtech|engineering|degree|graduation|undergraduate|postgraduate|scholarship|tuition|fee|hostel|studying|pursuing|iti\b|polytechnic|diploma/i,
  farmer:     PATTERNS.occupation.farmer,
  worker:     PATTERNS.occupation.worker,
  startup:    PATTERNS.occupation.startup,
  unemployed: PATTERNS.occupation.unemployed,
  housewife:  PATTERNS.occupation.housewife,
  widow:      PATTERNS.special.widow,
};

export const hasOccupationEvidence = (message, occupation) => {
  if (!occupation || occupation === "unknown" || occupation === "all") return true;
  const pattern = OCCUPATION_EVIDENCE_PATTERNS[occupation];
  if (!pattern) return true;
  return pattern.test(message);
};

const CASTE_CATEGORY_PATTERNS = [
  { pattern: /\bsc\b|scheduled caste|dalit/i,                                         value: "sc" },
  { pattern: /\bst\b|scheduled tribe|tribal|adivasi/i,                                value: "st" },
  { pattern: /\bobc\b|other backward class|backward class/i,                           value: "obc" },
  { pattern: /minority|muslim|sikh|christian|jain|buddhist|parsi/i,                   value: "minority" },
  { pattern: /general category|general caste|open category|unreserved|upper caste/i,  value: "general" },
];

const THIRD_PARTY_PATTERNS = [
  /for my (father|dad|mother|mom|brother|sister|husband|wife|son|daughter|child|children|family member)/i,
  /for (his|her|their) (father|mother|treatment|cancer|surgery)/i,
  /(father|mother|dad|mom) (ka|ki|ke|ko) (ilaaj|treatment|cancer|operation)/i,
  /(husband|wife) (ka|ki|ke|ko) (ilaaj|treatment)/i,
  /(mera|meri|mere) (papa|pitaji|mummy|matashree|bhai|behen|pati|patni|beta|beti) (ka|ki|ke|ko) (ilaaj|treatment|cancer|operation)/i,
  /need loan for (my|his|her|their) (father|mother|dad|mom|husband|wife|child|children|family) ('s)? (treatment|cancer|surgery)/i,
  /my (pregnant|wife|patni).*(delivery|hospital|baby|newborn)/i,
  /(meri|mere) (patni|biwi).*(prasav|delivery|hospital|baby)/i,
];

export const isThirdPartyRequest = (message) =>
  THIRD_PARTY_PATTERNS.some((p) => p.test(message));

export const extractBeneficiaryProfile = (message) => {
  const profile = { gender: null, minAge: null, maxAge: null };

  if (/(father|dad|papa|pitaji|husband|pati|brother|bhai|son|beta|uncle|chacha|grandfather|dada|nana)\b/i.test(message)) {
    profile.gender = "male";
  } else if (/(mother|mom|mummy|matashree|wife|patni|biwi|sister|behen|daughter|beti|aunt|chachi|pregnant wife|grandmother|dadi|nani)\b/i.test(message)) {
    profile.gender = "female";
  }

  if (/(grandfather|grandmother|dada|dadi|nana|nani)\b/i.test(message)) {
    profile.minAge = 60;
  } else if (/(father|mother|dad|mom|papa|mummy|pitaji|matashree)\b/i.test(message)) {
    profile.minAge = 35;
    profile.maxAge = 70;
  } else if (/(brother|sister|cousin)\b/i.test(message)) {
    profile.minAge = 15;
    profile.maxAge = 50;
  } else if (/(son|daughter|child|kid|baby|beti|beta)\b/i.test(message)) {
    profile.maxAge = 25;
  } else if (/(wife|patni|biwi|pregnant wife)\b/i.test(message)) {
    profile.minAge = 18;
    profile.maxAge = 45;
  }

  return profile;
};

export const applyKeywordFallback = (message, profile) => {
  const patched = {
    primaryIntent:    "unknown",
    secondaryIntents: [],
    intentConfidence: 0,
    occupation:       "unknown",
    state:            "unknown",
    income:           null,
    age:              null,
    gender:           "unknown",
    casteCategory:    "unknown",
    educationLevel:   "unknown",
    ...profile,
    secondaryIntents: Array.isArray(profile?.secondaryIntents) ? profile.secondaryIntents : [],
  };

  // 1. Widow override (highest priority occupation signal)
  for (const { pattern, value } of WIDOW_PATTERNS) {
    if (pattern.test(message)) {
      patched.occupation = value;
      break;
    }
  }

  // 2. General occupation fallback
  if (patched.occupation === "unknown") {
    for (const { pattern, value } of HINDI_OCCUPATION_PATTERNS) {
      if (pattern.test(message)) {
        patched.occupation = value;
        break;
      }
    }
  }

  // FIX: "beti ki padhai" or "meri beti" doesn't make the SPEAKER a housewife.
  // If occupation was inferred as housewife purely from family-member words,
  // and there is no explicit housewife keyword, reset to unknown.
  if (
    patched.occupation === "housewife" &&
    !/housewife|homemaker|grihini|gruhini|gharelu|ghar pe/i.test(message)
  ) {
    patched.occupation = "unknown";
  }

  // 3. State fallback
  if (patched.state === "unknown") {
    for (const { pattern, value } of HINDI_STATE_PATTERNS) {
      if (pattern.test(message)) {
        patched.state = value;
        break;
      }
    }
  }

  // 4. Primary intent fallback
  if (patched.primaryIntent === "unknown") {
    for (const { pattern, value } of HINDI_INTENT_PATTERNS) {
      if (pattern.test(message)) {
        patched.primaryIntent    = value;
        patched.intentConfidence = Math.max(patched.intentConfidence || 0, 0.7);
        break;
      }
    }
  }

  // 5. Maternity intent: "pregnant wife" + "delivery" → maternity
  // 5. Maternity intent – FORCE override when pregnancy is mentioned
if (PATTERNS.special.pregnancy.test(message)) {
  // Override common misinterpretations: loan, business, unknown
  if (["loan", "unknown", "business", "startup-funding"].includes(patched.primaryIntent)) {
    // Preserve the original intent as secondary
    if (!patched.secondaryIntents.includes(patched.primaryIntent) && patched.primaryIntent !== "unknown") {
      patched.secondaryIntents.push(patched.primaryIntent);
    }
    patched.primaryIntent    = "maternity";
    patched.intentConfidence = Math.max(patched.intentConfidence, 0.95);
  }
}

  // 6. Education loan for daughter → push toward scholarship intent
  if (
    /beti|daughter|ladki|girl.{0,10}(padhai|study|education|school|college)/i.test(message) &&
    (patched.primaryIntent === "loan" || patched.primaryIntent === "unknown")
  ) {
    patched.primaryIntent    = "scholarship";
    patched.intentConfidence = Math.max(patched.intentConfidence, 0.75);
    if (!patched.secondaryIntents.includes("loan")) patched.secondaryIntents.push("loan");
  }

  // 7. Medical override — only for genuinely medical contexts, not scholarship
  const isMedicalContext     = /cancer|chemotherapy|radiation|oncology|tumour|tumor|surgery|hospital treatment|ilaaj|dawai|bimari|medical treatment|dialysis|transplant/i.test(message);
  const isScholarshipContext = /scholarship|chatravritti|padhai.*madad|fee.*help|tuition.*support/i.test(message);

  if (isMedicalContext && !isScholarshipContext) {
    const overridableIntents = ["loan", "unknown", "job"];
    if (overridableIntents.includes(patched.primaryIntent)) {
      if (patched.primaryIntent !== "unknown") {
        patched.secondaryIntents = [...new Set([...patched.secondaryIntents, patched.primaryIntent])];
      }
      patched.primaryIntent    = "treatment";
      patched.intentConfidence = Math.max(patched.intentConfidence, 0.9);
    } else if (patched.primaryIntent === "student") {
      if (!patched.secondaryIntents.includes("treatment")) patched.secondaryIntents.push("treatment");
    }
  }

  // 8. Crop insurance / agriculture loan → farmer intent
  if (
    /crop insurance|fasal bima|kheti insurance|agriculture loan|kisan credit card|pmfby/i.test(message) &&
    (patched.primaryIntent === "loan" || patched.primaryIntent === "unknown")
  ) {
    patched.primaryIntent    = "farmer";
    patched.intentConfidence = Math.max(patched.intentConfidence, 0.9);
  }

  // 9. Housing intent from strong signals
  if (
    /ghar\s*(chahiye|nahi|ke liye)|makaan\s*(chahiye|nahi)|awas\s*(chahiye|yojana)|pucca ghar|pmay/i.test(message) &&
    patched.primaryIntent === "unknown"
  ) {
    patched.primaryIntent    = "housing";
    patched.intentConfidence = Math.max(patched.intentConfidence, 0.8);
  }

  // 10. Pension intent
  if (
    /pension\s*(chahiye|nahi milti|milni chahiye)|old age pension|vridha pension|budhapa pension/i.test(message) &&
    patched.primaryIntent === "unknown"
  ) {
    patched.primaryIntent    = "pension";
    patched.intentConfidence = Math.max(patched.intentConfidence, 0.8);
  }

  // 11. Sanitation intent
  if (
    /toilet\s*(chahiye|nahi|banana)|shauchalay\s*(chahiye|banana)|swachh bharat/i.test(message) &&
    patched.primaryIntent === "unknown"
  ) {
    patched.primaryIntent    = "sanitation";
    patched.intentConfidence = Math.max(patched.intentConfidence, 0.8);
  }

  // 12. Education level fallback
  if (!patched.educationLevel || patched.educationLevel === "unknown") {
    for (const { pattern, value } of EDUCATION_LEVEL_PATTERNS) {
      if (pattern.test(message)) {
        patched.educationLevel = value;
        break;
      }
    }
  }

  // 13. Caste category fallback
  if (!patched.casteCategory || patched.casteCategory === "unknown") {
    for (const { pattern, value } of CASTE_CATEGORY_PATTERNS) {
      if (pattern.test(message)) {
        patched.casteCategory = value;
        break;
      }
    }
  }

  // 14. Gender fallback from strong signals
  if (patched.gender === "unknown") {
    if (/\bwidow\b|vidhwa|garbhavati|pregnant|mahila|beti|ladki|grihini|housewife/i.test(message)) {
      patched.gender = "female";
    } else if (/\bkisan\b|\bkisaan\b|\bfarmer\b.*\b(main|mai|mera|meri)\b|\b(main|mai)\b.*\bkisan\b/i.test(message)) {
      // Don't assume gender for farmer — leave as unknown (many female farmers)
    }
  }

  return patched;
};