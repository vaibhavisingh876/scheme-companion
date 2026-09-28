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
const parseIncome = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const original = String(value)
    .toLowerCase()
    .trim();

  let str = original
    .replace(/₹/g, "")
    .replace(/rs\.?/g, "")
    .replace(/inr/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ");

  const numMatch = str.match(
    /(\d+(?:\.\d+)?)/
  );

  if (!numMatch) return null;

  let num = parseFloat(numMatch[1]);

  if (Number.isNaN(num)) return null;

  if (/\bcrore?s?\b/i.test(str)) {
    num *= 10000000;
  } else if (
    /\b(?:lakh|lac|lacs)\b/i.test(str)
  ) {
    num *= 100000;
  } else if (/\bthousand\b/i.test(str)) {
    num *= 1000;
  } else if (/\bk\b/i.test(str)) {
    num *= 1000;
  }

  if (
    /\b(?:per month|\/month|monthly)\b/i.test(
      original
    )
  ) {
    num *= 12;
  }

  return Math.round(num);
};

// ---------- Extract income from eligibility ----------
const extractIncomeLimits = (
  eligibility,
  fallbackValue = null
) => {
  const text = normalizeText(eligibility);

  let minIncome = null;
  let maxIncome = null;

  if (
    fallbackValue !== null &&
    fallbackValue !== undefined
  ) {
    maxIncome = parseIncome(fallbackValue);
  }

  if (!text) {
    return {
      minIncome,
      maxIncome,
    };
  }

  const incomePattern =
    "(?:annual|yearly|family|household)?\\s*(?:family\\s+)?income";

  const maxRegexes = [
    new RegExp(
      `(?:not exceed|does not exceed|should not exceed|less than or equal to|up to|upto|maximum|max(?:imum) of)\\s*(?:rs\\.?\\s*)?(\\d+(?:\\.\\d+)?\\s*(?:lakh|lac|crore|thousand|k)?)`,
      "i"
    ),
    new RegExp(
      `(?:${incomePattern}).{0,80}?(?:not exceed|does not exceed|should not exceed|less than|below|up to|upto|max(?:imum)?)\\s*(?:rs\\.?\\s*)?(\\d+(?:\\.\\d+)?\\s*(?:lakh|lac|crore|thousand|k)?)`,
      "i"
    ),
    new RegExp(
      `(?:rs\\.?\\s*)?(\\d+(?:\\.\\d+)?\\s*(?:lakh|lac|crore|thousand|k)?)\\s*(?:per annum|per year|annually)?\\s*(?:or less|or below|or less than|and below)`,
      "i"
    ),
  ];

  for (const regex of maxRegexes) {
    const match = text.match(regex);

    if (match) {
      const parsed = parseIncome(match[1]);

      if (parsed !== null) {
        maxIncome =
          maxIncome === null
            ? parsed
            : Math.min(maxIncome, parsed);

        break;
      }
    }
  }

  const minRegexes = [
    new RegExp(
      `(?:minimum|at least|not less than|more than|above|exceeding)\\s*(?:rs\\.?\\s*)?(\\d+(?:\\.\\d+)?\\s*(?:lakh|lac|crore|thousand|k)?)`,
      "i"
    ),
    new RegExp(
      `(?:${incomePattern}).{0,80}?(?:minimum|at least|not less than|more than|above|exceeding)\\s*(?:rs\\.?\\s*)?(\\d+(?:\\.\\d+)?\\s*(?:lakh|lac|crore|thousand|k)?)`,
      "i"
    ),
  ];

  for (const regex of minRegexes) {
    const match = text.match(regex);

    if (match) {
      const parsed = parseIncome(match[1]);

      if (parsed !== null) {
        minIncome =
          minIncome === null
            ? parsed
            : Math.max(minIncome, parsed);

        break;
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
  labelsArray,
  eligibilityText
) => {
  const labels = labelsArray.map(normalizeText);
  const eligibility =
    normalizeText(eligibilityText);

  const femalePatterns = [
    "women",
    "woman",
    "female",
    "girl",
    "girls",
    "mother",
    "mothers",
    "widow",
    "widows",
    "housewife",
    "homemaker",
    "grihini",
    "mahila",
    "ladki",
    "beti",
    "kanya",
    "bahu",
    "mata",
  ];

  const malePatterns = [
    "men",
    "male",
    "boy",
    "boys",
  ];

  const isFemale =
    hasAnyPattern(
      eligibility,
      femalePatterns
    ) ||
    labels.some((label) =>
      hasAnyPattern(label, femalePatterns)
    );

  const isMale =
    hasAnyPattern(
      eligibility,
      malePatterns
    ) ||
    labels.some((label) =>
      hasAnyPattern(label, malePatterns)
    );

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
  beneficiaryLabels,
  eligibilityText
) => {
  const allowedCategories = new Set();

  const labels =
    beneficiaryLabels.map(normalizeText);

  const eligibility =
    normalizeText(eligibilityText);

  const categoryPatterns = {
    sc: [
      "scheduled caste",
      "scheduled castes",
      "sc category",
      "sc candidates",
      "sc students",
      "dalit",
      "chambhar",
      "charmakar",
      "dhor",
      "mochi",
      "holar",
      "mahad",
      "mahar",
      "mang",
      "madiga",
      "adidravida",
    ],

    st: [
      "scheduled tribe",
      "scheduled tribes",
      "st category",
      "st candidates",
      "st students",
      "tribal",
      "tribals",
      "adivasi",
      "gond",
      "santhal",
      "koya",
    ],

    obc: [
      "other backward class",
      "other backward classes",
      "obc category",
      "obc candidates",
      "obc students",
      "backward class",
      "backward classes",
      "other backward community",
    ],

    ews: [
      "economically weaker section",
      "economically weaker sections",
      "ews category",
      "ews candidates",
      "ews students",
    ],

    minority: [
      "minority",
      "minority community",
      "minority communities",
      "religious minority",
      "muslim",
      "christian",
      "sikh",
      "jain",
      "buddhist",
      "parsi",
    ],
  };

  for (const [
    category,
    patterns,
  ] of Object.entries(categoryPatterns)) {
    const found =
      hasAnyPattern(
        eligibility,
        patterns
      ) ||
      labels.some((label) =>
        hasAnyPattern(label, patterns)
      );

    if (found) {
      allowedCategories.add(category);
    }
  }

  if (allowedCategories.size === 0) {
    allowedCategories.add("general");
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

  if (
    fallbackAge &&
    typeof fallbackAge === "object"
  ) {
    for (const key of Object.keys(
      fallbackAge
    )) {
      const range = fallbackAge[key];

      if (!range) continue;

      if (range.gte != null) {
        minAge =
          minAge === null
            ? Number(range.gte)
            : Math.max(
                minAge,
                Number(range.gte)
              );
      }

      if (range.lte != null) {
        maxAge =
          maxAge === null
            ? Number(range.lte)
            : Math.min(
                maxAge,
                Number(range.lte)
              );
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

  const maxPatterns = [
    /\b(?:below|under|not exceeding|upto|up to|at most|maximum|max(?:imum)?)\s+(\d+)\s*(?:years?|yrs?)\b/i,
    /\b(?:age|aged)\s*(?:should be\s*)?(?:less than|below|under|upto|up to)\s*(\d+)\s*(?:years?|yrs?)\b/i,
    /\b(?:\d+)\s*(?:years?|yrs?)\s*(?:or less|or below)\b/i,
  ];

  for (const regex of maxPatterns) {
    const match = text.match(regex);

    if (!match) continue;

    const parsedMax = parseInt(
      match[1],
      10
    );

    if (!Number.isNaN(parsedMax)) {
      maxAge =
        maxAge === null
          ? parsedMax
          : Math.min(
              maxAge,
              parsedMax
            );

      break;
    }
  }

  const minPatterns = [
    /\b(?:above|over|at least|minimum|min(?:imum)?)\s+(\d+)\s*(?:years?|yrs?)\b/i,
    /\b(?:age|aged)\s*(?:should be\s*)?(?:more than|above|over|at least)\s*(\d+)\s*(?:years?|yrs?)\b/i,
  ];

  for (const regex of minPatterns) {
    const match = text.match(regex);

    if (!match) continue;

    const parsedMin = parseInt(
      match[1],
      10
    );

    if (!Number.isNaN(parsedMin)) {
      minAge =
        minAge === null
          ? parsedMin
          : Math.max(
              minAge,
              parsedMin
            );

      break;
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
      eligibility
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
      eligibility
    );

  // ---------- Documents ----------
  let documentsRequired = null;

  if (
    Array.isArray(
      eligibilityObj.documentsRequired
    )
  ) {
    documentsRequired =
      eligibilityObj.documentsRequired
        .map(
          (d) => d?.label || d
        )
        .filter(Boolean);
  } else if (
    typeof eligibilityObj.documentsRequired ===
    "string"
  ) {
    documentsRequired =
      eligibilityObj.documentsRequired
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  } else if (
    Array.isArray(
      content.documentsRequired
    )
  ) {
    documentsRequired =
      content.documentsRequired
        .map(
          (d) => d?.label || d
        )
        .filter(Boolean);
  } else if (
    typeof content.documentsRequired ===
    "string"
  ) {
    documentsRequired =
      content.documentsRequired
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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