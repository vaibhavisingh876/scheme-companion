import crypto from "crypto";

// ---------- State normalization ----------
const stateMap = {
  up: "uttarpradesh",
  uttarpradesh: "uttarpradesh",
  mp: "madhyapradesh",
  madhyapradesh: "madhyapradesh",
  dl: "delhi",
  delhi: "delhi",
  nctdelhi: "delhi",
  dilli: "delhi",
  mh: "maharashtra",
  maharashtra: "maharashtra",
  gujarat: "gujarat",
  gujrat: "gujarat",
  gj: "gujarat",
  pb: "punjab",
  punjab: "punjab",
  hr: "haryana",
  haryana: "haryana",
  kar: "karnataka",
  karnataka: "karnataka",
  tn: "tamilnadu",
  tamilnadu: "tamilnadu",
  tg: "telangana",
  telangana: "telangana",
  ap: "andhrapradesh",
  andhrapradesh: "andhrapradesh",
  rj: "rajasthan",
  rajasthan: "rajasthan",
  br: "bihar",
  bihar: "bihar",
  wb: "westbengal",
  westbengal: "westbengal",
  jk: "jammukashmir",
  jammukashmir: "jammukashmir",
  uk: "uttarakhand",
  uttarakhand: "uttarakhand",
  cg: "chhattisgarh",
  chhattisgarh: "chhattisgarh",
  odisha: "odisha",
  orissa: "odisha",
  assam: "assam",
  as: "assam",
  hp: "himachalpradesh",
  himachalpradesh: "himachalpradesh",
  goa: "goa",
  mn: "manipur",
  manipur: "manipur",
  mg: "meghalaya",
  meghalaya: "meghalaya",
  tr: "tripura",
  tripura: "tripura",
  sk: "sikkim",
  sikkim: "sikkim",
  ar: "arunachalpradesh",
  arunachalpradesh: "arunachalpradesh",
  naga: "nagaland",
  nagaland: "nagaland",
  mz: "mizoram",
  mizoram: "mizoram",
  jh: "jharkhand",
  jharkhand: "jharkhand",
  ch: "chandigarh",
  chandigarh: "chandigarh",
  puducherry: "puducherry",
  pondicherry: "puducherry",
  py: "puducherry",
  andamannicobar: "andamannicobar",
  ladakh: "ladakh",
  lakshadweep: "lakshadweep",
  kerala: "kerala",
  daman: "damandiu",
  diu: "damandiu",
  dadra: "dadranagarhaveli",
  nagarhaveli: "dadranagarhaveli",
  dnh: "dadranagarhaveli",
  dd: "damandiu",
  dadraandnagarhavelianddamananddiu:
    "dadraandnagarhavelianddamananddiu",
  andamanandnicobarislands: "andamannicobar",
};

const normalizeState = (state = "") => {
  const cleaned = String(state || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  return stateMap[cleaned] || cleaned;
};

// ---------- Stable stringify ----------
const sortObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }

  if (obj && typeof obj === "object" && obj !== null) {
    const sorted = {};

    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortObject(obj[key]);
    }

    return sorted;
  }

  return obj;
};

const stableStringify = (obj) =>
  JSON.stringify(sortObject(obj));

// ---------- Tags ----------
const normalizeTags = (tags) => {
  if (!tags) return [];

  let raw = [];

  if (Array.isArray(tags)) {
    raw = tags
      .filter(Boolean)
      .map((t) => String(t).trim());
  } else if (typeof tags === "string") {
    raw = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return [
    ...new Set(raw.map((t) => t.toLowerCase())),
  ];
};

// ---------- Generic text helpers ----------
const normalizeText = (text = "") =>
  String(text || "")
    .replace(/&amp;#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\brs\./gi, "rs ")
    .replace(/\binr\./gi, "inr ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const hasPattern = (text, pattern) => {
  if (!text) return false;

  const regex = new RegExp(
    `\\b${pattern.replace(/\s+/g, "\\s+")}\\b`,
    "i"
  );

  return regex.test(text);
};

const hasAnyPattern = (text, patterns = []) =>
  patterns.some((pattern) =>
    hasPattern(text, pattern)
  );

// ---------- Income parser ----------
const parseCurrencyAmount = (rawStr, isMonthly = false) => {
  if (!rawStr) return null;
  const str = String(rawStr).toLowerCase().replace(/,/g, "").trim();
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return null;

  let num = parseFloat(numMatch[1]);
  if (Number.isNaN(num)) return null;

  if (/\b(?:crores?|cr)\b/i.test(str)) {
    num *= 10000000;
  } else if (/\b(?:lakhs?|lacs?)\b/i.test(str)) {
    num *= 100000;
  } else if (/\b(?:thousands?|k)\b/i.test(str)) {
    num *= 1000;
  } else if (num < 1000 && !isMonthly) {
    // Sanity check: Standalone numbers < 1000 without lakh/crore/thousand are NOT valid annual INR income limits
    return null;
  }

  if (isMonthly || /\b(?:per\s+month|\/month|monthly)\b/i.test(str)) {
    num *= 12;
  }

  return Math.round(num);
};

// ---------- Extract income from eligibility ----------
const extractIncomeLimits = (
  eligibility,
  fallbackValue = null
) => {
  let minIncome = null;
  let maxIncome = null;

  if (
    fallbackValue !== null &&
    fallbackValue !== undefined &&
    fallbackValue !== ""
  ) {
    const parsed = parseCurrencyAmount(String(fallbackValue));
    if (parsed !== null) maxIncome = parsed;
  }

  const text = normalizeText(eligibility);
  if (!text) {
    return {
      minIncome,
      maxIncome,
    };
  }

  // Clause splitting by punctuation to keep context bounded, preserving decimals like 3.5
  const clauses = text
    .split(/(?<!\d)\.(?!\d)|[;\n|]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const incomeKeywords =
    /\b(?:family\s+income|annual\s+income|household\s+income|parental\s+income|gross\s+income|total\s+income|family's\s+income|personal\s+income|income\s+ceiling|income\s+limit|annual\s+turnover|income)\b/i;

  const maxPatterns = [
    /(?:family\s+|personal\s+)?income.{0,60}?(?:less\s+than\s+or\s+equal\s+to|less\s+than|should\s+not\s+exceed|does\s+not\s+exceed|not\s+exceed|must\s+not\s+exceed|below|up\s*to|maximum\s+of|maximum|max|under|not\s+more\s+than|within|ceiling\s+of)\s*[:=]?\s*(?:rs|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|thousands?|k)?(?:\s*\/-)?(?:\s*(?:per\s+annum|per\s+year|p\.a\.|annually|per\s+month|monthly))?)/i,
    /(?:less\s+than\s+or\s+equal\s+to|less\s+than|should\s+not\s+exceed|does\s+not\s+exceed|not\s+exceed|must\s+not\s+exceed|below|up\s*to|maximum\s+of|maximum|under|not\s+more\s+than)\s*(?:of\s+)?(?:family\s+|personal\s+)?income\s*(?:of\s+)?[:=]?\s*(?:rs|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|thousands?|k)?(?:\s*\/-)?)/i,
    /(?:rs|inr|₹)\s*([\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|thousands?|k)?)\s*(?:per\s+annum|per\s+year|p\.a\.|annually)?\s*(?:or\s+less|or\s+below|or\s+less\s+than|and\s+below)/i,
  ];

  const minPatterns = [
    /(?:family\s+|personal\s+)?income.{0,60}?(?:minimum\s+of|minimum|min|at\s+least|not\s+less\s+than|must\s+not\s+be\s+less\s+than|more\s+than|above|exceeding|greater\s+than)\s*[:=]?\s*(?:rs|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|thousands?|k)?(?:\s*\/-)?(?:\s*(?:per\s+annum|per\s+year|p\.a\.|annually|per\s+month|monthly))?)/i,
  ];

  for (const clause of clauses) {
    if (!incomeKeywords.test(clause) && !/(?:rs|inr|₹)/i.test(clause)) {
      continue;
    }

    const rangeMatch = clause.match(
      /(?:family\s+|personal\s+)?income.{0,40}?(?:between|from)\s*(?:rs|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|thousands?|k)?)\s*(?:and|to|-)\s*(?:rs|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|thousands?|k)?)/i
    );
    if (rangeMatch) {
      const isMonthly = /\b(?:per\s+month|\/month|monthly)\b/i.test(clause);
      const minVal = parseCurrencyAmount(rangeMatch[1], isMonthly);
      const maxVal = parseCurrencyAmount(rangeMatch[2], isMonthly);
      if (minVal !== null && maxVal !== null) {
        minIncome = minIncome === null ? minVal : Math.max(minIncome, minVal);
        maxIncome = maxIncome === null ? maxVal : Math.min(maxIncome, maxVal);
        continue;
      }
    }

    if (maxIncome === null) {
      for (const pattern of maxPatterns) {
        const match = clause.match(pattern);
        if (match) {
          const isMonthly = /\b(?:per\s+month|\/month|monthly)\b/i.test(clause);
          const parsed = parseCurrencyAmount(match[1], isMonthly);
          if (parsed !== null) {
            maxIncome = parsed;
            break;
          }
        }
      }
    }

    if (minIncome === null) {
      for (const pattern of minPatterns) {
        const match = clause.match(pattern);
        if (match) {
          const isMonthly = /\b(?:per\s+month|\/month|monthly)\b/i.test(clause);
          const parsed = parseCurrencyAmount(match[1], isMonthly);
          if (parsed !== null) {
            minIncome = parsed;
            break;
          }
        }
      }
    }
  }

  return {
    minIncome,
    maxIncome,
  };
};

// ---------- Benefits ----------
const extractBenefitsText = (content) => {
  if (!content) return "";

  if (
    content.benefits_md &&
    typeof content.benefits_md === "string"
  ) {
    return content.benefits_md.trim();
  }

  if (Array.isArray(content.benefits)) {
    const parts = [];

    for (const item of content.benefits) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (
        item &&
        typeof item === "object"
      ) {
        if (Array.isArray(item.children)) {
          const childText = item.children
            .map((c) =>
              c && c.text ? c.text : ""
            )
            .join(" ");

          if (childText.trim()) {
            parts.push(childText.trim());
          }
        }

        if (item.label || item.value) {
          parts.push(
            `${item.label || ""} ${
              item.value || ""
            }`.trim()
          );
        }

        if (item.text && !item.children) {
          parts.push(item.text);
        }
      }
    }

    return parts.join(" | ").trim();
  }

  return (
    content.detailedDescription_md || ""
  ).trim();
};

// ---------- Eligibility text ----------
const extractEligibility = (
  eligibilityObj,
  basic
) => {
  if (!eligibilityObj && !basic) return "";

  if (
    eligibilityObj?.eligibilityDescription_md &&
    typeof eligibilityObj.eligibilityDescription_md ===
      "string"
  ) {
    return eligibilityObj
      .eligibilityDescription_md
      .trim();
  }

  if (
    Array.isArray(eligibilityObj?.criteria)
  ) {
    return eligibilityObj.criteria
      .map((c) => {
        if (typeof c === "string") return c;

        if (c?.description) {
          return c.description;
        }

        if (c?.label && c?.value) {
          return `${c.label}: ${c.value}`;
        }

        return "";
      })
      .filter(Boolean)
      .join(" | ");
  }

  return (
    basic?.eligibilityNote || ""
  ).trim();
};

// ---------- Education ----------
const parseEducationLevels = (
  labelsArray,
  text
) => {
  const levels = new Set();

  const lowerText = normalizeText(text);

  const candidates = [
    ...labelsArray.map((l) => normalizeText(l)),
    lowerText,
  ];

  const eduMap = {
    "below 10th": "below 10th",
    "10th": "10th",
    matric: "10th",
    matriculation: "10th",
    sslc: "10th",

    "12th": "12th",
    intermediate: "12th",
    hsc: "12th",
    puc: "12th",

    iti: "iti",
    diploma: "diploma",

    undergraduate: "graduate",
    bachelor: "graduate",
    graduate: "graduate",

    "post graduate": "post graduate",
    postgraduate: "post graduate",
    master: "post graduate",
    masters: "post graduate",

    phd: "phd",
    doctorate: "phd",

    professional: "professional",
    all: "all",
  };

  for (const entry of candidates) {
    for (const [pattern, level] of Object.entries(
      eduMap
    )) {
      if (hasPattern(entry, pattern)) {
        levels.add(level);
      }
    }
  }

  if (levels.size === 0) {
    levels.add("all");
  }

  return Array.from(levels);
};

// ---------- Gender ----------
const parseGender = (
  labelsArray = [],
  eligibilityText = "",
  schemeName = ""
) => {
  const labels = labelsArray.map((l) => String(l).toLowerCase().trim());
  const text = normalizeText(`${schemeName} ${eligibilityText}`).toLowerCase();

  const isExclusivelyFemaleLabel =
    labels.length > 0 &&
    labels.every((l) =>
      [
        "women",
        "woman",
        "female",
        "girl",
        "girls",
        "widow",
        "widows",
        "pregnant women",
        "lactating mothers",
      ].includes(l)
    );

  const explicitFemalePatterns = [
    /\b(?:only\s+(?:for\s+)?(?:women|female|females|girls|widows))\b/i,
    /\b(?:exclusively\s+(?:for\s+)?(?:women|female|females|girls|widows))\b/i,
    /\b(?:applicant\s+(?:must|should)\s+be\s+(?:a\s+)?(?:female|woman|girl|widow))\b/i,
    /\b(?:scheme\s+is\s+(?:only\s+)?for\s+(?:women|female|girls|widows))\b/i,
    /\b(?:applicable\s+only\s+to\s+(?:women|female|girls))\b/i,
    /\b(?:restricted\s+to\s+(?:women|female|girls))\b/i,
    /\b(?:for\s+(?:female|women|girl)\s+candidates\s+only)\b/i,
    /\b(?:girl\s+students?\s+only)\b/i,
    /\b(?:female\s+students?\s+only)\b/i,
    /\b(?:widow\s+pension)\b/i,
    /\b(?:destitute\s+women\s+pension)\b/i,
    /\b(?:sukanya\s+samriddhi)\b/i,
    /\b(?:beti\s+bachao)\b/i,
  ];

  const explicitMalePatterns = [
    /\b(?:only\s+(?:for\s+)?(?:men|male|boys))\b/i,
    /\b(?:applicant\s+(?:must|should)\s+be\s+(?:a\s+)?(?:male|man|boy))\b/i,
    /\b(?:for\s+(?:male|boy)\s+candidates\s+only)\b/i,
  ];

  // Preference / horizontal reservation guards (e.g. 33% quota for women or preference does not make scheme female-exclusive)
  const isPreferenceOnly =
    /\b(?:preference\s+(?:will\s+be\s+)?given\s+to\s+(?:women|female)|33%\s*(?:reservation|quota)?\s*for\s+women)\b/i.test(
      text
    );

  const isFemale =
    !isPreferenceOnly &&
    (isExclusivelyFemaleLabel ||
      explicitFemalePatterns.some((p) => p.test(text)));
  const isMale = explicitMalePatterns.some((p) => p.test(text));

  if (isFemale && !isMale) {
    return {
      gender: "female",
      isFemaleOnly: true,
      allowedGenders: ["female"],
    };
  }

  if (isMale && !isFemale) {
    return {
      gender: "male",
      isFemaleOnly: false,
      allowedGenders: ["male"],
    };
  }

  return {
    gender: "all",
    isFemaleOnly: false,
    allowedGenders: ["all"],
  };
};

// ---------- Categories ----------
const parseCategories = (
  beneficiaryLabels = [],
  eligibilityText = "",
  schemeName = ""
) => {
  const allowedCategories = new Set();
  const text = normalizeText(`${schemeName} ${eligibilityText}`).toLowerCase();

  const isOpenToAll =
    /\b(?:all\s+categories|irrespective\s+of\s+caste|general\s+and\s+reserved|open\s+category|all\s+communities|no\s+caste\s+restriction)\b/i.test(
      text
    );

  if (isOpenToAll) {
    return ["all"];
  }

  // Remove degree abbreviations before testing to prevent B.Sc / M.Sc false positives for SC
  const sanitizedText = text.replace(/\b(?:b\.?\s*sc|m\.?\s*sc)\b/gi, "");

  const categoryRegexes = {
    sc: /\b(?:scheduled\s+caste|scheduled\s+castes|sc\s+category|sc\s+candidates?|sc\s+students?|dalit|\bsc\b)\b/i,
    st: /\b(?:scheduled\s+tribe|scheduled\s+tribes|st\s+category|st\s+candidates?|st\s+students?|adivasi|tribals?|\bst\b)\b/i,
    obc: /\b(?:other\s+backward\s+class(?:es)?|obc\s+category|obc\s+candidates?|obc\s+students?|backward\s+class(?:es)?|\bobc\b)\b/i,
    ews: /\b(?:economically\s+weaker\s+section(?:s)?|ews\s+category|ews\s+candidates?|ews\s+students?|\bews\b)\b/i,
    minority:
      /\b(?:minority\s+communit(?:y|ies)|religious\s+minority|notified\s+minorities|minority\s+students?|\bminority\b)\b/i,
  };

  for (const [cat, regex] of Object.entries(categoryRegexes)) {
    if (regex.test(sanitizedText)) {
      allowedCategories.add(cat);
    }
  }

  // Default to 'all' if no specific category restriction is identified (never assume General-only)
  if (allowedCategories.size === 0) {
    return ["all"];
  }

  return Array.from(allowedCategories);
};

// ---------- Occupations ----------
const parseOccupations = (
  beneficiaryLabels,
  eligibilityText
) => {
  const occSet = new Set();

  const labels =
    beneficiaryLabels.map(normalizeText);

  const eligibility =
    normalizeText(eligibilityText);

  const occMap = {
    farmer: [
      "farmer",
      "farmers",
      "kisan",
      "agriculturist",
      "agricultural worker",
      "cultivator",
    ],

    student: [
      "student",
      "students",
      "vidyarthi",
      "pupil",
      "scholar",
    ],

    worker: [
      "worker",
      "workers",
      "labour",
      "labor",
      "labourer",
      "laborer",
      "mazdoor",
      "shramik",
      "daily wage worker",
    ],

    startup: [
      "entrepreneur",
      "entrepreneurs",
      "startup",
      "startups",
      "udyami",
      "self employed",
      "self-employed",
      "business owner",
    ],

    unemployed: [
      "unemployed",
      "unemployment",
      "berozgaar",
      "jobless",
    ],

    housewife: [
      "housewife",
      "homemaker",
      "grihini",
    ],

    widow: [
      "widow",
      "widows",
      "vidhwa",
    ],

    artisan: [
      "artisan",
      "artisans",
      "weaver",
      "weavers",
      "handicraft",
      "potter",
      "potters",
    ],

    fisherman: [
      "fisherman",
      "fishermen",
      "fisher",
      "fisheries worker",
      "machhuara",
    ],
  };

  for (const [
    occupation,
    patterns,
  ] of Object.entries(occMap)) {
    const found =
      hasAnyPattern(
        eligibility,
        patterns
      ) ||
      labels.some((label) =>
        hasAnyPattern(label, patterns)
      );

    if (found) {
      occSet.add(occupation);
    }
  }

  if (occSet.size === 0) {
    occSet.add("all");
  }

  return Array.from(occSet);
};

// ---------- Scholarship ----------
const SCHOLARSHIP_PATTERNS = [
  "scholarship",
  "fee reimbursement",
  "tuition fee",
  "student aid",
  "student support",
  "student welfare",
  "stipend",
  "post matric",
  "pre matric",
  "jee",
  "neet",
  "gate",
  "upsc",
  "fellowship",
  "studentship",
  "education loan",
  "vidyadhan",
  "pratibha",
  "merit cum means",
  "free education",
  "freeship",
  "grant",
];

// ---------- Age extraction ----------
const extractAgeLimits = (
  eligibility,
  fallbackAge = null
) => {
  let minAge = null;
  let maxAge = null;

  if (fallbackAge && typeof fallbackAge === "object") {
    for (const key of Object.keys(fallbackAge)) {
      const range = fallbackAge[key];
      if (!range) continue;
      if (range.gte != null) {
        minAge =
          minAge === null
            ? Number(range.gte)
            : Math.max(minAge, Number(range.gte));
      }
      if (range.lte != null) {
        maxAge =
          maxAge === null
            ? Number(range.lte)
            : Math.min(maxAge, Number(range.lte));
      }
    }
  }

  const text = normalizeText(eligibility);
  if (!text) {
    return {
      minAge,
      maxAge,
    };
  }

  const clauses = text
    .split(/(?<!\d)\.(?!\d)|[;\n|]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const isNonAgeExperienceOrTenure = (clause, matchIndex) => {
    const surrounding = clause.slice(
      Math.max(0, matchIndex - 30),
      matchIndex + 60
    );
    return /\b(?:experience|service|residen(?:ce|t)|staying|tenure|imprisonment|sentence|course\s+duration)\b/i.test(
      surrounding
    );
  };

  const rangePatterns = [
    /(?:applicant|candidate|person)?\s*(?:must\s+be\s+)?(?:between|from)\s+(\d{1,2})\s*(?:years?|yrs?)?\s*(?:and|to|-|–)\s*(\d{1,2})\s*(?:years?|yrs?)(?:\s+of\s+age)?/i,
    /\bage\s*(?:limit|criteria|group|bracket)?\s*(?:is|should\s+be|between)?\s*[:=]?\s*(\d{1,2})\s*(?:to|-|–)\s*(\d{1,2})\s*(?:years?|yrs?)?/i,
    /\b(\d{1,2})\s*(?:to|-|–)\s*(\d{1,2})\s*(?:years?|yrs?)\s+of\s+age\b/i,
    /\bage\s*(?:group\s+of|between)\s*(\d{1,2})\s*(?:to|-|–|and)\s*(\d{1,2})\b/i,
  ];

  const maxPatterns = [
    /\b(?:age|aged).{0,30}?(?:less\s+than|below|under|up\s*to|at\s+most|maximum|not\s+exceeding|not\s+more\s+than)\s*(\d{1,2})\s*(?:years?|yrs?)(?:\s+of\s+age)?\b/i,
    /\bmaximum\s+age\s*(?:limit|criteria)?\s*(?:is|should\s+be)?\s*[:=]?\s*(\d{1,2})\s*(?:years?|yrs?)?\b/i,
    /\b(?:below|under|not\s+exceeding|at\s+most)\s+(\d{1,2})\s*(?:years?|yrs?)\s+of\s+age\b/i,
    /\b(\d{1,2})\s*(?:years?|yrs?)\s*(?:or\s+less|or\s+below)\b/i,
  ];

  const minPatterns = [
    /\b(?:age|aged).{0,30}?(?:more\s+than|above|over|at\s+least|minimum|not\s+less\s+than)\s*(\d{1,2})\s*(?:years?|yrs?)(?:\s+of\s+age)?\b/i,
    /\bminimum\s+age\s*(?:limit|criteria)?\s*(?:is|should\s+be)?\s*[:=]?\s*(\d{1,2})\s*(?:years?|yrs?)?\b/i,
    /\b(?:applicant|candidate).{0,30}?(?:not\s+be\s+less\s+than|at\s+least)\s*(\d{1,2})\s*(?:years?|yrs?)\s+of\s+age\b/i,
    /\b(?:above|over|at\s+least)\s+(\d{1,2})\s*(?:years?|yrs?)\s+of\s+age\b/i,
  ];

  for (const clause of clauses) {
    if (minAge === null || maxAge === null) {
      for (const pattern of rangePatterns) {
        const match = clause.match(pattern);
        if (match && !isNonAgeExperienceOrTenure(clause, match.index || 0)) {
          const a1 = parseInt(match[1], 10);
          const a2 = parseInt(match[2], 10);
          if (a1 >= 0 && a1 <= 100 && a2 >= 0 && a2 <= 100) {
            const low = Math.min(a1, a2);
            const high = Math.max(a1, a2);
            minAge = minAge === null ? low : Math.max(minAge, low);
            maxAge = maxAge === null ? high : Math.min(maxAge, high);
            break;
          }
        }
      }
    }

    if (maxAge === null) {
      for (const pattern of maxPatterns) {
        const match = clause.match(pattern);
        if (match && !isNonAgeExperienceOrTenure(clause, match.index || 0)) {
          const parsed = parseInt(match[1], 10);
          if (parsed >= 0 && parsed <= 100) {
            maxAge = parsed;
            break;
          }
        }
      }
    }

    if (minAge === null) {
      for (const pattern of minPatterns) {
        const match = clause.match(pattern);
        if (match && !isNonAgeExperienceOrTenure(clause, match.index || 0)) {
          const parsed = parseInt(match[1], 10);
          if (parsed >= 0 && parsed <= 100) {
            minAge = parsed;
            break;
          }
        }
      }
    }
  }

  return {
    minAge,
    maxAge,
  };
};

// ---------- Main normalizer ----------
export const normalizeMyScheme = (
  detailData,
  searchFields = {}
) => {
  if (!detailData) return null;

  const basic =
    detailData.basicDetails || {};

  const content =
    detailData.schemeContent || {};

  const eligibilityObj =
    detailData.eligibilityCriteria || {};

  const externalId =
    searchFields.slug ||
    basic.schemeSlug ||
    detailData._id;

  if (!externalId) return null;

  const name = (
    basic.schemeName ||
    "Untitled Scheme"
  ).trim();

  const description =
    (
      content.briefDescription ||
      ""
    ).trim();

  const benefits =
    extractBenefitsText(content);

  const eligibility =
    extractEligibility(
      eligibilityObj,
      basic
    );

  const tags =
    normalizeTags(basic.tags);

  const category =
    basic.schemeCategory?.length
      ? basic.schemeCategory
          .map((c) => c.label || c)
          .join(", ")
      : "General";

  const ministry =
    (
      typeof basic.nodalMinistryName ===
      "string"
        ? basic.nodalMinistryName
        : basic.nodalMinistryName?.label
    ) ||
    (
      typeof basic.nodalDepartmentName ===
      "string"
        ? basic.nodalDepartmentName
        : basic.nodalDepartmentName?.label
    ) ||
    "Central Government";

  // ---------- State extraction ----------
  let rawState = "All India";
  const allowedStates = [];

  const extractStateList = (
    source
  ) => {
    if (!source) return [];

    if (Array.isArray(source)) {
      return source
        .filter(Boolean)
        .map((s) =>
          String(s).trim()
        )
        .filter(
          (s) =>
            s &&
            s.toLowerCase() !==
              "all india" &&
            s.toLowerCase() !== "all"
        );
    }

    if (
      typeof source === "string" &&
      source.trim()
    ) {
      const trimmed =
        source.trim();

      if (
        trimmed.toLowerCase() !==
          "all india" &&
        trimmed.toLowerCase() !== "all"
      ) {
        return [trimmed];
      }
    }

    return [];
  };

  const stateCandidates = [
    ...extractStateList(
      basic.allowedStates
    ),
    ...extractStateList(
      searchFields.beneficiaryState
    ),
    ...extractStateList(
      basic.state
    ),
  ];

  const uniqueStates = [
    ...new Set(stateCandidates),
  ];

  if (uniqueStates.length > 0) {
    const normalizedStates =
      uniqueStates
        .map((state) =>
          normalizeState(state)
        )
        .filter(Boolean);

    rawState =
      normalizedStates.join(", ");

    for (const state of normalizedStates) {
      if (
        !allowedStates.includes(state)
      ) {
        allowedStates.push(state);
      }
    }
  }

  if (
    allowedStates.length === 0
  ) {
    allowedStates.push("all");
  }

  // ---------- Beneficiaries ----------
  const targetBeneficiaries =
    Array.isArray(
      basic.targetBeneficiaries
    )
      ? basic.targetBeneficiaries
      : [];

  const beneficiaryLabels =
    targetBeneficiaries
      .map(
        (b) =>
          (
            b?.label ||
            b ||
            ""
          )
            .toString()
            .toLowerCase()
            .trim()
      )
      .filter(Boolean);

  // ---------- Categories ----------
  const finalAllowedCategories =
    parseCategories(
      beneficiaryLabels,
      eligibility,
      name
    );

  // ---------- Occupations ----------
  const allowedOccupations =
    parseOccupations(
      beneficiaryLabels,
      eligibility
    );

  // ---------- Scholarship ----------
  const combinedScholarshipText =
    normalizeText(
      `${name} ${description} ${eligibility} ${tags.join(
        " "
      )}`
    );

  const isScholarship =
    SCHOLARSHIP_PATTERNS.some(
      (pattern) =>
        hasPattern(
          combinedScholarshipText,
          pattern
        )
    );

  // ---------- Scheme metadata ----------
  const schemeFor =
    basic.schemeFor ||
    "Individual";

  // ---------- Age ----------
  const {
    minAge,
    maxAge,
  } = extractAgeLimits(
    eligibility,
    searchFields.age ||
      basic.age
  );

  // ---------- Income ----------
  const {
    minIncome,
    maxIncome,
  } = extractIncomeLimits(
    eligibility,
    searchFields.familyIncomeLimit ||
      basic.familyIncomeLimit
  );

  // ---------- Education ----------
  const educationLabels =
    Array.isArray(
      basic.educationLevel
    )
      ? basic.educationLevel.map(
          (e) => e?.label || e
        )
      : [];

  const educationLevels =
    parseEducationLevels(
      educationLabels,
      `${eligibility} ${description}`
    );

  const primaryEducation =
    educationLevels[0];

  // ---------- Gender ----------
  const genderInfo =
    parseGender(
      beneficiaryLabels,
      eligibility,
      name
    );

// ---------- Documents ----------
let documentsRequired = null;

if (Array.isArray(eligibilityObj.documentsRequired)) {
  documentsRequired = eligibilityObj.documentsRequired
    .map((d) => d?.label || d)
    .filter(Boolean)
    .join(", ");
} else if (typeof eligibilityObj.documentsRequired === "string") {
  documentsRequired = eligibilityObj.documentsRequired
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
} else if (Array.isArray(content.documentsRequired)) {
  documentsRequired = content.documentsRequired
    .map((d) => d?.label || d)
    .filter(Boolean)
    .join(", ");
} else if (typeof content.documentsRequired === "string") {
  documentsRequired = content.documentsRequired
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

  // ---------- Final normalized object ----------
  const normalized = {
    externalId:
      String(externalId).trim(),

    name,
    description,
    benefits,
    eligibility,

    category,
    ministry,

    state: rawState,

    occupation:
      allowedOccupations[0],

    educationLevel:
      primaryEducation,

    gender:
      genderInfo.gender,

    allowedCategories:
      finalAllowedCategories,

    allowedStates,

    allowedGenders:
      genderInfo.allowedGenders,

    allowedOccupations,

    allowedEducationLevels:
      educationLevels,

    minIncome,
    maxIncome,

    minAge,
    maxAge,

    isScholarship,

    isFemaleOnly:
      genderInfo.isFemaleOnly,

    schemeFor,

    applicationLink:
      searchFields.applicationLink ||
      basic.applicationLink ||
      null,

    sourceUrl:
      searchFields.sourceUrl ||
      basic.sourceUrl ||
      null,

    documentsRequired,

    tags,
  };

  const checksum = crypto
    .createHash("md5")
    .update(
      stableStringify(normalized)
    )
    .digest("hex");

  return {
    ...normalized,
    sourceId: "myscheme",
    checksum,
  };
};