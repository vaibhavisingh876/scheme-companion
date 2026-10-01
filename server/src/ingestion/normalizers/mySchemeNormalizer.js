import crypto from "crypto";
import { pipeline } from "@xenova/transformers";

const SEMANTIC_MODEL = "Xenova/all-MiniLM-L6-v2";
const SEMANTIC_THRESHOLD = 0.55;
const SEMANTIC_MARGIN = 0.08;

let embeddingPipeline = null;

const canonicalEmbeddingCache = new Map();

const stateMap = {
  "andhra pradesh": "andhrapradesh",
  "arunachal pradesh": "arunachalpradesh",
  assam: "assam",
  bihar: "bihar",
  chhattisgarh: "chhattisgarh",
  goa: "goa",
  gujarat: "gujarat",
  haryana: "haryana",
  "himachal pradesh": "himachalpradesh",
  jharkhand: "jharkhand",
  karnataka: "karnataka",
  kerala: "kerala",
  "madhya pradesh": "madhyapradesh",
  maharashtra: "maharashtra",
  manipur: "manipur",
  meghalaya: "meghalaya",
  mizoram: "mizoram",
  nagaland: "nagaland",
  odisha: "odisha",
  orissa: "odisha",
  punjab: "punjab",
  rajasthan: "rajasthan",
  sikkim: "sikkim",
  "tamil nadu": "tamilnadu",
  telangana: "telangana",
  tripura: "tripura",
  "uttar pradesh": "uttarpradesh",
  uttarakhand: "uttarakhand",
  "west bengal": "westbengal",
  delhi: "delhi",
  "jammu and kashmir": "jammuandkashmir",
  ladakh: "ladakh",
  puducherry: "puducherry",
  chandigarh: "chandigarh",
  "dadra and nagar haveli and daman and diu":
    "dadranagarhavelianddamananddiu",
  "dadra & nagar haveli and daman & diu":
    "dadranagarhavelianddamananddiu",
  lakshadweep: "lakshadweep",
  "andaman and nicobar islands":
    "andamanandnicobarislands",
};

const SEMANTIC_CONCEPTS = {
  occupation: {
    farmer: [
      "farmer",
      "cultivator",
      "person engaged in farming",
      "person cultivating agricultural land",
      "agricultural worker",
    ],
    fisherman: [
      "fisherman",
      "fishermen",
      "fisher",
      "person engaged in fishing",
      "person whose occupation is fishing",
    ],
    weaver: [
      "weaver",
      "handloom weaver",
      "person engaged in weaving",
      "handloom worker",
    ],
    student: [
      "student",
      "school student",
      "college student",
      "person studying",
      "person pursuing studies",
    ],
    artisan: [
      "artisan",
      "craftsperson",
      "craft worker",
      "traditional artisan",
    ],
    entrepreneur: [
      "entrepreneur",
      "business owner",
      "businessperson",
      "enterprise owner",
    ],
    worker: [
      "worker",
      "labourer",
      "laborer",
      "wage worker",
      "daily wage worker",
    ],
    unemployed: [
      "unemployed person",
      "unemployed youth",
      "person without employment",
    ],
  },

  education: {
    "below 10th": [
      "below class 10",
      "below 10th standard",
    ],
    "10th": [
      "class 10",
      "10th class",
      "10th standard",
      "matriculation",
      "secondary school",
    ],
    "11th": [
      "class 11",
      "11th class",
      "11th standard",
      "higher secondary first year",
    ],
    "12th": [
      "class 12",
      "12th class",
      "12th standard",
      "senior secondary",
      "intermediate",
      "plus two",
    ],
    diploma: [
      "diploma",
      "polytechnic diploma",
    ],
    undergraduate: [
      "undergraduate",
      "bachelor degree",
      "bachelor's degree",
      "graduate degree",
    ],
    postgraduate: [
      "postgraduate",
      "post graduation",
      "master degree",
      "master's degree",
    ],
    professional: [
      "professional course",
      "professional degree",
      "professional qualification",
    ],
    phd: [
      "PhD",
      "doctoral degree",
      "doctorate",
      "post doctoral degree",
      "postdoctoral degree",
    ],
  },
};

const normalizeText = (value) => {
  if (!value) return "";

  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*{1,3}/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
};

const hasAnyPattern = (text, patterns) =>
  patterns.some((pattern) => pattern.test(text));

const extractRichText = (node) => {
  if (!node) return "";

  if (typeof node === "string") {
    return normalizeText(node);
  }

  if (Array.isArray(node)) {
    return node
      .map(extractRichText)
      .filter(Boolean)
      .join("\n");
  }

  if (typeof node === "object") {
    const parts = [];

    if (node.text) {
      parts.push(String(node.text));
    }

    if (node.children) {
      parts.push(extractRichText(node.children));
    }

    if (node.content) {
      parts.push(extractRichText(node.content));
    }

    if (node.value) {
      parts.push(String(node.value));
    }

    return normalizeText(
      parts.filter(Boolean).join("\n")
    );
  }

  return "";
};

const parseCurrencyAmount = (value, unit = "") => {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/\brs\.?\b/gi, "")
    .trim();

  const number = parseFloat(cleaned);

  if (!Number.isFinite(number)) {
    return null;
  }

  const normalizedUnit = unit.toLowerCase();
  // Scheme income filters are stored in PostgreSQL INT columns. Treat implausible
  // or out-of-range parsed thresholds as unknown so one bad source value cannot
  // abort the entire createMany sync batch.
  const amount = number * (
    normalizedUnit.includes("crore") ? 10000000 :
      normalizedUnit.includes("lakh") || normalizedUnit.includes("lac") ? 100000 :
        normalizedUnit.includes("thousand") ? 1000 : 1
  );
  return Number.isSafeInteger(amount) && amount <= 2147483647 ? amount : null;
};

const extractIncomeLimits = (text) => {
  const normalized = normalizeText(text);

  let minIncome = null;
  let maxIncome = null;

  const maxPatterns = [
    /\b(?:annual|yearly|family)?\s*income\b.{0,80}?\b(?:not exceed|less than|below|upto|up to|maximum)\s*(?:₹|rs\.?)?\s*([\d,.]+)\s*(crore|crores|lakh|lakhs|lac|lacs|thousand)?/i,

    /\b(?:income|annual income|yearly income)\b.{0,60}?(?:₹|rs\.?)\s*([\d,.]+)\s*(crore|crores|lakh|lakhs|lac|lacs|thousand)?/i,

    /(?:₹|rs\.?)\s*([\d,.]+)\s*(crore|crores|lakh|lakhs|lac|lacs|thousand)?\s*(?:per year|annually|annual)/i,
  ];

  for (const pattern of maxPatterns) {
    const match = normalized.match(pattern);

    if (!match) continue;

    const amount = parseCurrencyAmount(
      match[1],
      match[2]
    );

    if (amount !== null) {
      maxIncome = amount;
      break;
    }
  }

  const minPatterns = [
    /\bincome\b.{0,60}?\b(?:minimum|at least|not less than)\s*(?:₹|rs\.?)?\s*([\d,.]+)\s*(crore|crores|lakh|lakhs|lac|lacs|thousand)?/i,

    /(?:₹|rs\.?)\s*([\d,.]+)\s*(crore|crores|lakh|lakhs|lac|lacs|thousand)?\s*(?:minimum|at least)/i,
  ];

  for (const pattern of minPatterns) {
    const match = normalized.match(pattern);

    if (!match) continue;

    const amount = parseCurrencyAmount(
      match[1],
      match[2]
    );

    if (amount !== null) {
      minIncome = amount;
      break;
    }
  }

  return {
    minIncome,
    maxIncome,
  };
};

const extractAgeLimits = (text) => {
  const normalized = normalizeText(text).toLowerCase();

  const hasQualificationDependentAge =
    /\b(?:below|under|less than|upto|up to|not exceed)\s+\d{1,3}\s+years?\s+for\s+(?:graduates?|post\s*graduates?|postgraduates?|phd|doctorate|be|btech|mtech|ms)\b/i.test(
      normalized
    ) ||
    /\b\d{1,3}\s+years?\s+(?:for\s+)?(?:graduates?|post\s*graduates?|postgraduates?|phd|doctorate|be|btech|mtech|ms)\b/i.test(
      normalized
    ) ||
    /\b(?:graduates?|post\s*graduates?|postgraduates?|phd|doctorate|be|btech|mtech|ms)\b.{0,100}?\b\d{1,3}\s+years?\b/i.test(
      normalized
    ) ||
    /\b(?:graduates?|post\s*graduates?|postgraduates?|phd|doctorate|be|btech|mtech|ms)\b.{0,100}?\b(?:below|under|less than|upto|up to|not exceed)\s+\d{1,3}\b/i.test(
      normalized
    );

  let minAge = null;
  let maxAge = null;

  const rangeMatch =
  normalized.match(
    /\bbetween\s+(\d{1,3})\s+and\s+(\d{1,3})\s+years?\b/i
  ) ||
  normalized.match(
    /\b(\d{1,3})\s*(?:years?\s*)?(?:to|-|–|—)\s*(\d{1,3})\s*years?\b/i
  );

if (rangeMatch) {
  minAge = Number(rangeMatch[1]);
  maxAge = Number(rangeMatch[2]);
}

  const betweenMatch = normalized.match(
    /\bbetween\s+(\d{1,3})\s+and\s+(\d{1,3})\s+years?\b/
  );

  if (betweenMatch) {
    minAge = Number(betweenMatch[1]);
    maxAge = Number(betweenMatch[2]);
  }

  const agedBetweenMatch = normalized.match(
    /\baged\s+between\s+(\d{1,3})\s+and\s+(\d{1,3})\s+years?\b/
  );

  if (agedBetweenMatch) {
    minAge = Number(agedBetweenMatch[1]);
    maxAge = Number(agedBetweenMatch[2]);
  }

  const agedOrAboveMatch = normalized.match(
    /\baged\s+(\d{1,3})\s+years?\s+or\s+above\b/
  );

  if (agedOrAboveMatch) {
    minAge = Number(agedOrAboveMatch[1]);
  }

  const plusMatch = normalized.match(
    /\bage\s*(?:of\s*)?(\d{1,3})\s*\+/
  );

  if (plusMatch) {
    minAge = Number(plusMatch[1]);
  }

  const aboveMatch = normalized.match(
    /\b(?:age|aged)?\s*(?:above|over)\s+(\d{1,3})\s*years?\b/
  );

  if (aboveMatch) {
    minAge = Number(aboveMatch[1]);
  }

  const upperMatch = normalized.match(
    /\b(?:age|aged)?\s*(?:under|below|less than)\s+(\d{1,3})\s*years?\b/
  );

  if (upperMatch) {
    maxAge = Number(upperMatch[1]);
  }

  const exceedMatch = normalized.match(
    /\bage\b.{0,50}?\b(?:not exceed|should not exceed|maximum|max)\s*(\d{1,3})/i
  );

  if (exceedMatch) {
    maxAge = Number(exceedMatch[1]);
  }

  const upperLimitMatch = normalized.match(
    /\b(?:upper age limit|upper age)\b.{0,30}?\b(\d{1,3})\b/
  );

  if (upperLimitMatch) {
    maxAge = Number(upperLimitMatch[1]);
  }

  if (hasQualificationDependentAge) {
    minAge = null;
    maxAge = null;
  }

  return {
    minAge,
    maxAge,
  };
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];

  return tags
    .map(normalizeText)
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());
};

const extractBenefitsText = (detail) => {
  const benefits =
    detail?.schemeContent?.benefits;

  if (!benefits) return "";

  if (typeof benefits === "string") {
    return normalizeText(benefits);
  }

  return extractRichText(benefits);
};

const extractDocumentsText = (detail) => {
  const content = detail?.schemeContent;

  if (!content) return "";

  if (content.documentsRequired_md) {
    return normalizeText(content.documentsRequired_md);
  }

  if (typeof content.documentsRequired === "string") {
    return normalizeText(content.documentsRequired);
  }

  if (content.documentsRequired) {
    return extractRichText(content.documentsRequired);
  }

  return "";
};

const extractEligibility = (detail) => {
  const eligibilityCriteria =
    detail?.eligibilityCriteria;

  let eligibilityText = "";

  if (
    eligibilityCriteria?.eligibilityDescription_md
  ) {
    eligibilityText = normalizeText(
      eligibilityCriteria.eligibilityDescription_md
    );
  } else if (
    eligibilityCriteria?.eligibilityDescription
  ) {
    eligibilityText = extractRichText(
      eligibilityCriteria.eligibilityDescription
    );
  } else if (eligibilityCriteria) {
    eligibilityText =
      extractRichText(eligibilityCriteria);
  }

  const exclusions =
    detail?.schemeContent?.exclusions;

  let exclusionText = "";

  if (typeof exclusions === "string") {
    exclusionText = normalizeText(exclusions);
  } else if (exclusions) {
    exclusionText =
      extractRichText(exclusions);
  }

  if (exclusionText) {
    return `${eligibilityText}\n\nExclusions: ${exclusionText}`;
  }

  return eligibilityText;
};

const splitEligibilityAndExclusions = (text) => {
  const normalized = normalizeText(text);

  const match = normalized.match(
    /\bExclusions?\s*:/i
  );

  if (!match) {
    return {
      positive: normalized,
      exclusions: "",
    };
  }

  return {
    positive: normalized
      .slice(0, match.index)
      .trim(),

    exclusions: normalized
      .slice(match.index + match[0].length)
      .trim(),
  };
};

const splitIntoClauses = (text) => {
  if (!text) return [];

  const prepared = normalizeText(text)
    .replace(
      /\b(Essential Qualifications?)\b/gi,
      "\n$1\n"
    )
    .replace(
      /\b(Desirable Qualifications?)\b/gi,
      "\n$1\n"
    )
    .replace(
      /\b(Preference\s*\/\s*Weightage)\b/gi,
      "\n$1\n"
    )
    .replace(
      /\b(Age Limit)\b/gi,
      "\n$1\n"
    )
    .replace(
      /\b(Exclusions?)\s*:/gi,
      "\n$1:\n"
    );

  return prepared
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((clause) =>
      clause
        .replace(/^\s*[-*•]\s*/, "")
        .replace(/^\s*\d+[.)]\s*/, "")
        .trim()
    )
    .filter(
      (clause) => clause.length >= 8
    );
};

const isRelaxationClause = (clause) => {
  const text = clause.toLowerCase();

  return (
    /\bage relaxation\b/.test(text) ||
    /\brelaxation of\b/.test(text) ||
    /\brelaxation\b.*\byears?\b/.test(text) ||
    /\brelaxed by\b/.test(text)
  );
};

const isMentorClause = (clause) => {
  const text = clause.toLowerCase();

  return (
    /\bmentor\b/.test(text) ||
    /\bguide\b/.test(text) ||
    /\bco-guide\b/.test(text) ||
    /\bco guide\b/.test(text)
  );
};

const isNoteClause = (clause) => {
  const text = clause
    .toLowerCase()
    .trim()
    .replace(/^>+\s*/, "")
    .replace(/^\*{1,3}\s*/, "")
    .replace(/^\*{1,3}\s*:\s*/, ":")
    .trim();

  return (
    /^note\s*:/.test(text) ||
    /^note\b/.test(text) ||
    /\bfor information only\b/.test(text) ||
    /\bplease note\b/.test(text)
  );
};

const isOperationalClause = (clause) => {
  const text = clause.toLowerCase().trim();

  return (
    /\battendance\b/.test(text) ||
    /\bbiometric\b/.test(text) ||
    /\baebas\b/.test(text) ||
    /\bon the job training\b/.test(text) ||
    /\bojt\b/.test(text) ||
    /\btraining provider\b/.test(text) ||
    /\bfinal assessment\b/.test(text) ||
    /\bcompletion of ojt\b/.test(text) ||
    /\bspecial exemptions?\b/.test(text) ||
    /\bproject work\b/.test(text)
  );
};

const isContinuationClause = (clause) => {
  const text = clause.toLowerCase().trim();

  return /^(should|must|shall|may|can|and|or|also|such|whose|which|that|provided|provided that)\b/.test(
    text
  );
};

const isMentorContinuationClause = (clause) => {
  const text = clause.toLowerCase().trim();

  return (
    isContinuationClause(clause) ||
    /^degree\b/.test(text) ||
    /^in\s+(science|engineering|technology|medicine|arts|commerce)\b/.test(
      text
    )
  );
};

const hasExplicitApplicantSignal = (clause) => {
  const text = clause.toLowerCase();

  return (
    /\bapplicant\b/.test(text) ||
    /\bapplicants\b/.test(text) ||
    /\bcandidate\b/.test(text) ||
    /\bcandidates\b/.test(text) ||
    /\bstudent\b/.test(text) ||
    /\bstudents\b/.test(text) ||
    /\bfellow\b/.test(text) ||
    /\bfellows\b/.test(text) ||
    /\bbeneficiary\b/.test(text) ||
    /\bbeneficiaries\b/.test(text)
  );
};

const isGeneralInstitutionClause = (clause) => {
  const text = clause.toLowerCase();

  return (
    /\bhost institution\b/.test(text) ||
    /\binstitution should\b/.test(text) ||
    /\bresearch institution\b/.test(text)
  );
};

const isPreferenceClause = (clause) => {
  const text = clause.toLowerCase().trim();

  return (
    /^preference\s*\/\s*weightage\b/.test(text) ||
    /\bpreference will be given\b/.test(text) ||
    /\bpreference shall be given\b/.test(text) ||
    /\bpreference is given\b/.test(text) ||
    /\bpreference to\b/.test(text) ||
    /\bpriority will be given\b/.test(text) ||
    /\bpriority shall be given\b/.test(text) ||
    /\bpriority is given\b/.test(text) ||
    /\btie[-\s]?breaker\b/.test(text) ||
    /\bin case of a tie\b/.test(text) ||
    /\bin the event of a tie\b/.test(text) ||
    /\bwhere multiple applicants\b.*\bpreference\b/.test(text)
  );
};

const isDefinitionClause = (clause) => {
  const text = clause.toLowerCase().trim();

  return (
    /^the word .+ means\b/.test(text) ||
    /^the term .+ means\b/.test(text) ||
    /\bwill be considered part of the family\b/.test(
      text
    ) ||
    /\bconsidered part of the family\b/.test(text)
  );
};

const getQualificationSection = (clause) => {
  const text = clause.toLowerCase().trim();

  if (/^essential qualifications?$/.test(text)) {
    return "essential";
  }

  if (/^desirable qualifications?$/.test(text)) {
    return "desirable";
  }

  return null;
};

const isPreferenceHeading = (clause) => {
  const text = clause.toLowerCase().trim();

  return /^preference\s*\/\s*weightage\b/.test(text);
};

const isAgeHeading = (clause) => {
  return /^age limit\b/i.test(clause.trim());
};

const classifyClause = (
  clause,
  previousType = null,
  previousClause = "",
  qualificationContext = null
) => {
  const qualificationSection =
    getQualificationSection(clause);

  if (qualificationSection === "essential") {
    return "essential-section";
  }

  if (qualificationSection === "desirable") {
    return "desirable-section";
  }

  if (isPreferenceHeading(clause)) {
    return "preference-section";
  }

  if (isAgeHeading(clause)) {
    return "age-section";
  }

  if (isRelaxationClause(clause)) {
    return "relaxation";
  }

  if (isNoteClause(clause)) {
    return "note";
  }

  if (isPreferenceClause(clause)) {
    return "preference";
  }

  if (isDefinitionClause(clause)) {
    return "definition";
  }

  if (isOperationalClause(clause)) {
    return "operational";
  }

  if (isMentorClause(clause)) {
    return "mentor";
  }

  if (isGeneralInstitutionClause(clause)) {
    return "institution";
  }

  if (qualificationContext === "preference") {
    return "preference";
  }

  if (qualificationContext === "desirable") {
    return "desirable";
  }

  if (qualificationContext === "essential") {
    return "eligibility";
  }

  if (
    previousType === "mentor" &&
    isMentorContinuationClause(clause) &&
    !hasExplicitApplicantSignal(clause)
  ) {
    return "mentor";
  }

  if (
    previousType === "institution" &&
    isContinuationClause(clause) &&
    !hasExplicitApplicantSignal(clause)
  ) {
    return "institution";
  }

  return "eligibility";
};

const classifyClausesWithContext = (
  clauses
) => {
  const classified = [];

  let previousType = null;
  let previousClause = "";
  let qualificationContext = null;

  for (const clause of clauses) {
    const trimmed = clause.trim();

    const section =
      getQualificationSection(clause);

    if (section === "essential") {
      qualificationContext = "essential";

      classified.push({
        clause,
        type: "essential-section",
        qualificationContext,
      });

      previousType = "essential-section";
      previousClause = clause;
      continue;
    }

    if (section === "desirable") {
      qualificationContext = "desirable";

      classified.push({
        clause,
        type: "desirable-section",
        qualificationContext,
      });

      previousType = "desirable-section";
      previousClause = clause;
      continue;
    }

    if (isPreferenceHeading(clause)) {
      qualificationContext = "preference";

      classified.push({
        clause,
        type: "preference-section",
        qualificationContext,
      });

      previousType = "preference-section";
      previousClause = clause;
      continue;
    }

    if (isAgeHeading(clause)) {
      qualificationContext = null;

      classified.push({
        clause,
        type: "age-section",
        qualificationContext: null,
      });

      previousType = "age-section";
      previousClause = clause;
      continue;
    }

    if (/^exclusions?\s*:/i.test(trimmed)) {
      qualificationContext = null;

      classified.push({
        clause,
        type: "exclusion-section",
        qualificationContext: null,
      });

      previousType = "exclusion-section";
      previousClause = clause;
      continue;
    }

    const type = classifyClause(
      clause,
      previousType,
      previousClause,
      qualificationContext
    );

    let finalType = type;

    if (
      previousType === "age-section" &&
      isNoteClause(clause)
    ) {
      finalType = "note";
    }

    if (
      previousType === "age-section" &&
      !isNoteClause(clause) &&
      !isRelaxationClause(clause)
    ) {
      finalType = "age-eligibility";
    }

    classified.push({
      clause,
      type: finalType,
      qualificationContext,
    });

    previousType = finalType;
    previousClause = clause;
  }

  return classified;
};

const extractExplicitCategories = (text) => {
  const normalized =
    normalizeText(text).toLowerCase();

  const categories = new Set();

  const rules = [
    {
      key: "sc",
      patterns: [
        /\bscheduled caste\b/i,
        /\bscheduled castes\b/i,
        /\bsc\s+category\b/i,
        /\bsc\s*\/\s*st\b/i,
      ],
    },

    {
      key: "st",
      patterns: [
        /\bscheduled tribe\b/i,
        /\bscheduled tribes\b/i,
        /\bst\s+category\b/i,
        /\bsc\s*\/\s*st\b/i,
      ],
    },

    {
      key: "obc",
      patterns: [
        /\bother backward class\b/i,
        /\bother backward classes\b/i,
        /\bobc\s+category\b/i,
        /\bobc\b/i,
      ],
    },

    {
      key: "mbc",
      patterns: [
        /\bmost backward class\b/i,
        /\bmost backward classes\b/i,
        /\bmbc\b/i,
      ],
    },

    {
      key: "ews",
      patterns: [
        /\beconomically weaker section\b/i,
        /\beconomically weaker sections\b/i,
        /\bews\s+category\b/i,
        /\bews\b/i,
      ],
    },

    {
      key: "dnt",
      patterns: [
        /\bde[-\s]?notified\b/i,
        /\bdenotified\b/i,
        /\bnomadic\b/i,
        /\bsemi[-\s]?nomadic\b/i,
        /\bdnt\b/i,
      ],
    },

    {
      key: "minority",
      patterns: [
        /\bminority community\b/i,
        /\bminority communities\b/i,
        /\bminorities\b/i,
        /\breligious minority\b/i,
      ],
    },
  ];

  for (const rule of rules) {
    if (
      hasAnyPattern(
        normalized,
        rule.patterns
      )
    ) {
      categories.add(rule.key);
    }
  }

  return [...categories];
};

const extractExplicitGender = (text) => {
  const normalized =
    normalizeText(text).toLowerCase();

  const femaleApplicant =
    /\b(?:female|women|woman|girl|girls)\s+(?:applicant|applicants|beneficiary|beneficiaries|candidate|candidates)\b/.test(
      normalized
    ) ||
    /\b(?:applicant|applicants|beneficiary|beneficiaries|candidate|candidates)\s+(?:must be|should be|shall be|is|are)\s+(?:a\s+)?(?:female|woman|girl)\b/.test(
      normalized
    );

  const maleApplicant =
    /\b(?:male|men|man|boy|boys)\s+(?:applicant|applicants|beneficiary|beneficiaries|candidate|candidates)\b/.test(
      normalized
    ) ||
    /\b(?:applicant|applicants|beneficiary|beneficiaries|candidate|candidates)\s+(?:must be|should be|shall be|is|are)\s+(?:a\s+)?(?:male|man|boy)\b/.test(
      normalized
    );

  if (
    femaleApplicant &&
    !maleApplicant
  ) {
    return {
      gender: "female",
      allowedGenders: ["female"],
      isFemaleOnly: true,
    };
  }

  if (
    maleApplicant &&
    !femaleApplicant
  ) {
    return {
      gender: "male",
      allowedGenders: ["male"],
      isFemaleOnly: false,
    };
  }

  return {
    gender: "all",
    allowedGenders: [],
    isFemaleOnly: false,
  };
};

const extractExplicitEducation = (
  text
) => {
  const normalized =
    normalizeText(text).toLowerCase();

  const education = new Set();

  const hasCombinedDoctoralForm =
    /\bph\s*\.?\s*d\s*\.?\s*\/\s*m\s*\.?\s*d\s*\.?\s*\/\s*m\s*\.?\s*s\s*\.?\b/.test(
      normalized
    );

  const hasPhd =
    /\bph\s*\.?\s*d\s*\.?\b/.test(
      normalized
    ) ||
    /\bdoctoral degree\b/.test(
      normalized
    ) ||
    /\bdoctoral\b/.test(normalized) ||
    /\bdoctorate\b/.test(normalized) ||
    /\bpost[-\s]?doctoral\b/.test(
      normalized
    );

  if (
    hasPhd ||
    hasCombinedDoctoralForm
  ) {
    education.add("phd");
  }

  if (
    /\bclass\s*9\b/.test(normalized) ||
    /\b9th\s*(?:class|standard)?\b/.test(
      normalized
    )
  ) {
    education.add("9th");
  }

  if (
    /\bclass\s*10\b/.test(normalized) ||
    /\b10th\s*(?:class|standard)?\b/.test(
      normalized
    ) ||
    /\bmatriculation\b/.test(
      normalized
    ) ||
    /\bsecondary school\b/.test(
      normalized
    )
  ) {
    education.add("10th");
  }

  if (
    /\bclass\s*11\b/.test(normalized) ||
    /\b11th\s*(?:class|standard)?\b/.test(
      normalized
    )
  ) {
    education.add("11th");
  }

  if (
    /\bclass\s*12\b/.test(normalized) ||
    /\b12th\s*(?:class|standard)?\b/.test(
      normalized
    ) ||
    /\bsenior secondary\b/.test(
      normalized
    ) ||
    /\bhigher secondary\b/.test(
      normalized
    ) ||
    /\bintermediate\b/.test(normalized) ||
    /\bplus two\b/.test(normalized) ||
    /\bhsslc\b/.test(normalized) ||
    /\bhigher\s+secondary\s+(?:school\s+)?leaving\s+certificate\b/.test(
      normalized
    )
  ) {
    education.add("12th");
  }

  if (
    /\bdiploma\b/.test(normalized) ||
    /\bpolytechnic\b/.test(normalized)
  ) {
    education.add("diploma");
  }

  if (
    /\bundergraduate\b/.test(
      normalized
    ) ||
    /\bbachelor(?:'s)? degree\b/.test(
      normalized
    ) ||
    /\bgraduate degree\b/.test(
      normalized
    )
  ) {
    education.add("undergraduate");
  }

  const hasMastersDegree =
    /\bmaster(?:'s)? degree\b/.test(
      normalized
    ) ||
    /\bmaster degree\b/.test(
      normalized
    ) ||
    /\bpostgraduate\b/.test(
      normalized
    ) ||
    /\bpost graduation\b/.test(
      normalized
    ) ||
    /\bm\s*\.?\s*s\s*\.?\s*(?:degree|in)\b/.test(
      normalized
    );

  const hasMedicalDegree =
    /\bm\s*\.?\s*d\s*\.?\s*(?:degree|in)\b/.test(
      normalized
    ) ||
    /\bmedical degree\b/.test(
      normalized
    );

  if (
    hasMastersDegree ||
    hasMedicalDegree
  ) {
    if (!hasCombinedDoctoralForm) {
      education.add("postgraduate");
    }
  }

  if (
    /\bprofessional course\b/.test(
      normalized
    ) ||
    /\bprofessional degree\b/.test(
      normalized
    ) ||
    /\bprofessional qualification\b/.test(
      normalized
    )
  ) {
    education.add("professional");
  }

  if (
    /\bbelow\s+(?:class\s*)?10\b/.test(
      normalized
    ) ||
    /\bbelow\s+10th\b/.test(
      normalized
    )
  ) {
    education.add("below 10th");
  }

  return [...education];
};

const extractExplicitOccupations = (
  text
) => {
  const normalized =
    normalizeText(text).toLowerCase();

  const occupations = new Set();

  const rules = [
    {
      key: "farmer",
      patterns: [
        /\bcultivator\b/i,
        /\bfarmers?\b/i,
        /\bagricultural worker\b/i,
        /\bperson engaged in farming\b/i,
      ],
    },

    {
      key: "fisherman",
      patterns: [
        /\bfisherman\b/i,
        /\bfishermen\b/i,
        /\bfisher\b/i,
        /\bperson engaged in fishing\b/i,
      ],
    },

    {
      key: "weaver",
      patterns: [
        /\bweaver\b/i,
        /\bhandloom weaver\b/i,
      ],
    },

    {
      key: "student",
      patterns: [
        /\bstudent\b/i,
        /\bschool student\b/i,
        /\bcollege student\b/i,
        /\bpupil\b/i,
      ],
    },

    {
      key: "artisan",
      patterns: [
        /\bartisan\b/i,
        /\bcraftsperson\b/i,
        /\bcraft worker\b/i,
      ],
    },

    {
      key: "entrepreneur",
      patterns: [
        /\bentrepreneur\b/i,
        /\bbusiness owner\b/i,
        /\bbusinessperson\b/i,
      ],
    },

    {
      key: "worker",
      patterns: [
        /\blabou?rer\b/i,
        /\bwage worker\b/i,
        /\bdaily wage worker\b/i,
      ],
    },
  ];

  for (const rule of rules) {
    if (
      hasAnyPattern(
        normalized,
        rule.patterns
      )
    ) {
      occupations.add(rule.key);
    }
  }

  return [...occupations];
};

const getEmbeddingPipeline = async () => {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      "feature-extraction",
      SEMANTIC_MODEL
    );
  }

  return embeddingPipeline;
};

const getEmbedding = async (text) => {
  const extractor =
    await getEmbeddingPipeline();

  const output = await extractor(
    text,
    {
      pooling: "mean",
      normalize: true,
    }
  );

  return Array.from(output.data);
};

const cosineSimilarity = (a, b) => {
  if (
    !a ||
    !b ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (
    normA === 0 ||
    normB === 0
  ) {
    return 0;
  }

  return (
    dot /
    (Math.sqrt(normA) *
      Math.sqrt(normB))
  );
};

const getCanonicalEmbedding = async (
  concept
) => {
  if (
    canonicalEmbeddingCache.has(
      concept
    )
  ) {
    return canonicalEmbeddingCache.get(
      concept
    );
  }

  const embedding =
    await getEmbedding(concept);

  canonicalEmbeddingCache.set(
    concept,
    embedding
  );

  return embedding;
};

const extractSemanticFilters = async (
  clauses,
  threshold = SEMANTIC_THRESHOLD
) => {
  const result = {
    occupation: new Set(),
    education: new Set(),
  };

  const debug = {
    clauses: [],
    matches: {
      occupation: [],
      education: [],
    },
  };

  for (const clauseInfo of clauses) {
    const {
      clause,
      type,
    } = clauseInfo;

    if (type !== "eligibility") {
      debug.clauses.push({
        clause,
        type,
        skipped: true,
        reason:
          "Not an applicant eligibility clause",
        matches: [],
      });

      continue;
    }

    const clauseEmbedding =
      await getEmbedding(clause);

    const clauseDebug = {
      clause,
      type,
      skipped: false,
      matches: [],
    };

    for (const [
      conceptType,
      concepts,
    ] of Object.entries(
      SEMANTIC_CONCEPTS
    )) {
      for (const [
        key,
        phrases,
      ] of Object.entries(concepts)) {
        let bestScore = -1;
        let bestPhrase = "";

        for (const phrase of phrases) {
          const canonicalEmbedding =
            await getCanonicalEmbedding(
              phrase
            );

          const score =
            cosineSimilarity(
              clauseEmbedding,
              canonicalEmbedding
            );

          if (
            score > bestScore
          ) {
            bestScore = score;
            bestPhrase = phrase;
          }
        }

        clauseDebug.matches.push({
          type: conceptType,
          key,
          score: Number(
            bestScore.toFixed(4)
          ),
          matchedPhrase:
            bestPhrase,
        });
      }
    }

    clauseDebug.matches.sort(
      (a, b) =>
        b.score - a.score
    );

    const allMatches =
      clauseDebug.matches;

    clauseDebug.matches =
      allMatches.slice(0, 12);

    for (const conceptType of [
      "occupation",
      "education",
    ]) {
      const typeMatches =
        allMatches
          .filter(
            (match) =>
              match.type ===
              conceptType
          )
          .sort(
            (a, b) =>
              b.score - a.score
          );

      if (
        typeMatches.length === 0
      ) {
        continue;
      }

      const best =
        typeMatches[0];

      const second =
        typeMatches[1];

      const margin = second
        ? best.score -
          second.score
        : best.score;

      const accepted =
        best.score >=
          threshold &&
        margin >=
          SEMANTIC_MARGIN;

      if (accepted) {
        result[
          conceptType
        ].add(best.key);

        debug.matches[
          conceptType
        ].push({
          clause,
          key: best.key,
          score: best.score,
          matchedPhrase:
            best.matchedPhrase,
          margin: Number(
            margin.toFixed(4)
          ),
        });
      }
    }

    debug.clauses.push(
      clauseDebug
    );
  }

  return {
    filters: {
      occupation: [
        ...result.occupation,
      ],
      education: [
        ...result.education,
      ],
    },
    debug,
  };
};

const extractStructuredFilters = async (
  eligibilityText
) => {
  const {
    positive,
    exclusions,
  } =
    splitEligibilityAndExclusions(
      eligibilityText
    );

  const allClauses =
    splitIntoClauses(
      positive
    );

  const classifiedClauses =
    classifyClausesWithContext(
      allClauses
    );

  const eligibilityOnly =
    classifiedClauses.filter(
      (item) =>
        item.type ===
        "eligibility"
    );

  const eligibilityTextOnly =
    eligibilityOnly
      .map(
        (item) => item.clause
      )
      .join(" ");

  const explicitCategories =
    extractExplicitCategories(
      eligibilityTextOnly
    );

  const explicitEducation =
    extractExplicitEducation(
      eligibilityTextOnly
    );

  const explicitOccupations =
    extractExplicitOccupations(
      eligibilityTextOnly
    );

  const explicitGender =
    extractExplicitGender(
      eligibilityTextOnly
    );

  const age =
    extractAgeLimits(
      positive
    );

  const income =
    extractIncomeLimits(
      eligibilityTextOnly
    );

  const semantic =
    await extractSemanticFilters(
      classifiedClauses
    );

  const categories = [
    ...new Set(
      explicitCategories
    ),
  ];

  const educationLevels = [
    ...new Set([
      ...explicitEducation,
      ...semantic.filters.education,
    ]),
  ];

  const occupations = [
    ...new Set([
      ...explicitOccupations,
      ...semantic.filters.occupation,
    ]),
  ];

  return {
    allowedCategories:
      categories,

    allowedEducationLevels:
      educationLevels,

    allowedOccupations:
      occupations,

    genderInfo:
      explicitGender,

    minAge:
      age.minAge,

    maxAge:
      age.maxAge,

    minIncome:
      income.minIncome,

    maxIncome:
      income.maxIncome,

    semanticDebug: {
      clauses:
        semantic.debug.clauses,

      matches:
        semantic.debug.matches,

      classifiedClauses,
    },

    exclusions,
  };
};

const normalizeState = (
  state
) => {
  if (!state) return "all";

  const normalized =
    normalizeText(state)
      .toLowerCase();

  return (
    stateMap[
      normalized
    ] ||
    normalized.replace(
      /[^a-z0-9]/g,
      ""
    )
  );
};

const extractStateList = (
  detail,
  fallback = {}
) => {
  const states = new Set();

  const basicState =
    detail?.basicDetails?.state
      ?.label ||
    detail?.basicDetails?.state
      ?.name;

  if (basicState) {
    states.add(
      normalizeState(
        basicState
      )
    );
  }

  const beneficiaryState =
    fallback?.beneficiaryState;

  if (
    Array.isArray(
      beneficiaryState
    )
  ) {
    for (
      const state of beneficiaryState
    ) {
      if (
        state &&
        normalizeText(
          state
        ).toLowerCase() !==
          "all"
      ) {
        states.add(
          normalizeState(
            state
          )
        );
      }
    }
  }

  if (states.size === 0) {
    return ["all"];
  }

  return [
    ...states,
  ];
};

const extractApplicationLink = (
  detail
) => {
  const applicationProcess =
    detail?.schemeContent
      ?.applicationProcess;

  if (
    Array.isArray(
      applicationProcess
    )
  ) {
    for (
      const item of applicationProcess
    ) {
      if (item?.url) {
        return item.url;
      }

      if (item?.link) {
        return item.link;
      }
    }
  }

  if (
    detail?.applicationLink
  ) {
    return detail.applicationLink;
  }

  return null;
};

const detectScholarship = (
  name,
  tags,
  eligibility
) => {
  const text =
    normalizeText(
      `${name || ""} ${tags.join(
        " "
      )} ${eligibility || ""}`
    ).toLowerCase();

  return (
    /\bscholarship\b/.test(
      text
    ) ||
    /\bscholarships\b/.test(
      text
    )
  );
};

export const normalizeMyScheme =
  async (
    detail,
    searchFields = {}
  ) => {
    if (!detail) {
      return null;
    }

    const basicDetails =
      detail.basicDetails ||
      {};

    const name =
      basicDetails.schemeName ||
      searchFields.schemeName ||
      "";

    const description =
      normalizeText(
        basicDetails.briefDescription ||
          basicDetails.description ||
          searchFields.briefDescription ||
          ""
      );

    const eligibility =
      extractEligibility(
        detail
      );

    const tags =
      normalizeTags(
        detail.tags ||
          basicDetails.tags ||
          searchFields.tags ||
          []
      );

    const benefits =
      extractBenefitsText(
        detail
      );

    const structured =
      await extractStructuredFilters(
        eligibility
      );

    const allowedStates =
      extractStateList(
        detail,
        searchFields
      );

    const category =
      searchFields
        .schemeCategory?.[0] ||
      basicDetails
        .schemeCategory?.[0] ||
      "all";

    const ministryValue =
      basicDetails
        .nodalMinistryName ||
      searchFields
        .nodalMinistryName ||
      "Central Government";
    // The portal sometimes returns a ministry as a { label, value } object.
    // Keep the normalized record and its checksum aligned with the String DB column.
    const ministry =
      ministryValue && typeof ministryValue === "object"
        ? ministryValue.label || ministryValue.name || ministryValue.value || "Central Government"
        : ministryValue;

    const schemeFor =
      basicDetails.schemeFor ||
      searchFields.schemeFor ||
      "Individual";

    const applicationLink =
      extractApplicationLink(
        detail
      );

    const externalId =
      detail.slug ||
      basicDetails.slug ||
      searchFields.slug ||
      "";

    const sourceUrl = externalId
      ? `https://www.myscheme.gov.in/schemes/${externalId}`
      : null;

    const isScholarship =
      detectScholarship(
        name,
        tags,
        eligibility
      );

    const normalizedForChecksum =
      {
        name,
        description,
        benefits,
        eligibility,
        category,
        ministry,
        allowedStates,
        allowedCategories:
          structured.allowedCategories,
        allowedGenders:
          structured.genderInfo
            .allowedGenders,
        allowedOccupations:
          structured.allowedOccupations,
        allowedEducationLevels:
          structured.allowedEducationLevels,
        minIncome:
          structured.minIncome,
        maxIncome:
          structured.maxIncome,
        minAge:
          structured.minAge,
        maxAge:
          structured.maxAge,
        isScholarship,
      };

    const checksum =
      crypto
        .createHash("sha256")
        .update(
          JSON.stringify(
            normalizedForChecksum
          )
        )
        .digest("hex");

    return {
      externalId,
      name,
      description,
      benefits,
      eligibility,
      category,
      ministry,

      state:
        allowedStates[0] ||
        "all",

      occupation:
        structured
          .allowedOccupations[0] ||
        "all",

      educationLevel:
        structured
          .allowedEducationLevels[0] ||
        "all",

      gender:
        structured.genderInfo
          .gender || "all",

      allowedCategories:
        structured
          .allowedCategories
          .length
          ? structured
              .allowedCategories
          : ["all"],

      allowedStates,

      allowedGenders:
        structured.genderInfo
          .allowedGenders,

      allowedOccupations:
        structured
          .allowedOccupations
          .length
          ? structured
              .allowedOccupations
          : ["all"],

      allowedEducationLevels:
        structured
          .allowedEducationLevels
          .length
          ? structured
              .allowedEducationLevels
          : ["all"],

      minIncome:
        structured.minIncome,

      maxIncome:
        structured.maxIncome,

      minAge:
        structured.minAge,

      maxAge:
        structured.maxAge,

      isScholarship,

      isFemaleOnly:
        structured.genderInfo
          .isFemaleOnly,

      schemeFor,
      applicationLink,
      sourceUrl,

      documentsRequired:
        extractDocumentsText(detail),

      tags,

      sourceId: "myscheme",

      checksum,

      _semanticDebug:
        structured.semanticDebug,
    };
  };

export {
  classifyClausesWithContext,
};

export const debugSemanticFilters =
  async (
    detailOrEligibility
  ) => {
    let eligibilityText = "";

    if (
      typeof detailOrEligibility ===
      "string"
    ) {
      eligibilityText =
        detailOrEligibility;
    } else {
      eligibilityText =
        extractEligibility(
          detailOrEligibility
        );
    }

    const {
      positive,
      exclusions,
    } =
      splitEligibilityAndExclusions(
        eligibilityText
      );

    const structured =
      await extractStructuredFilters(
        eligibilityText
      );

    return {
      positiveEligibility:
        positive,

      exclusions,

      final: {
        categories:
          structured
            .allowedCategories,

        education:
          structured
            .allowedEducationLevels,

        occupations:
          structured
            .allowedOccupations,

        gender:
          structured.genderInfo,

        age: {
          minAge:
            structured.minAge,
          maxAge:
            structured.maxAge,
        },

        income: {
          minIncome:
            structured.minIncome,
          maxIncome:
            structured.maxIncome,
        },
      },

      semantic:
        structured.semanticDebug,
    };
  };

export {
  extractAgeLimits,
  extractIncomeLimits,
  extractExplicitCategories,
  extractExplicitEducation,
  extractExplicitOccupations,
  extractExplicitGender,
  extractSemanticFilters,
  splitEligibilityAndExclusions,
  splitIntoClauses,
  classifyClause,
};
