import crypto from "crypto";

// ----- State normalization (with all UTs added) -----
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
  dadraandnagarhavelianddamananddiu: "dadraandnagarhavelianddamananddiu",
  andamanandnicobarislands: "andamannicobar",
};

const normalizeState = (state = "") => {
  const cleaned = String(state || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  return stateMap[cleaned] || cleaned;
};

// ----- Recursively sort object keys (proper stable stringify) -----
const sortObject = (obj) => {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === "object" && obj !== null) {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortObject(obj[key]);
    }
    return sorted;
  }
  return obj;
};

const stableStringify = (obj) => JSON.stringify(sortObject(obj));

// ----- Tags: deduplicate using Set -----
const normalizeTags = (tags) => {
  if (!tags) return [];
  let raw = [];
  if (Array.isArray(tags)) {
    raw = tags.filter(Boolean).map((t) => String(t).trim());
  } else if (typeof tags === "string") {
    raw = tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [...new Set(raw.map(t => t.toLowerCase()))];  // ✅ no backslash
};

// ----- Income parser (FIXED: dot escaped) -----
const parseIncome = (value) => {
  if (!value) return null;
  const str = String(value).toLowerCase().replace(/\s+/g, "").trim();
  let multiplier = 1;
  if (str.includes("permonth") || str.includes("/month") || str.includes("monthly")) {
    multiplier = 12;
  }
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);   // ✅ properly escaped dot
  if (!numMatch) return null;
  let num = parseFloat(numMatch[1]);
  if (Number.isNaN(num)) return null;
  if (str.includes("crore")) num *= 10000000;      // ✅ no backslash
  else if (str.includes("lakh") || str.includes("lac")) num *= 100000;
  else if (str.includes("thousand") || str.includes("k")) num *= 1000;
  return Math.round(num * multiplier);
};

const extractBenefitsText = (content) => {
  if (!content) return "";
  if (content.benefits_md && typeof content.benefits_md === "string") return content.benefits_md.trim();
  if (Array.isArray(content.benefits)) {
    const parts = [];
    for (const item of content.benefits) {
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object") {
        if (Array.isArray(item.children)) {
          const childText = item.children.map(c => (c && c.text) ? c.text : "").join(" ");
          if (childText.trim()) parts.push(childText.trim());
        }
        if (item.label || item.value) parts.push(`${item.label || ""} ${item.value || ""}`.trim()); // ✅ no **
        if (item.text && !item.children) parts.push(item.text);
      }
    }
    return parts.join(" | ").trim();
  }
  return (content.detailedDescription_md || "").trim();
};

const extractEligibility = (eligibilityObj, basic) => {
  if (!eligibilityObj && !basic) return "";
  if (eligibilityObj?.eligibilityDescription_md) return eligibilityObj.eligibilityDescription_md.trim();
  if (Array.isArray(eligibilityObj?.criteria)) {
    return eligibilityObj.criteria
      .map(c => {
        if (typeof c === "string") return c;
        if (c?.description) return c.description;
        if (c?.label && c?.value) return `${c.label}: ${c.value}`;
        return "";
      })
      .filter(Boolean)
      .join(" | ");
  }
  return (basic?.eligibilityNote || "").trim();
};

// ----- Education levels (exact phrase matching with word boundaries) -----
const parseEducationLevels = (labelsArray, text) => {
  const levels = new Set();
  const lowerText = (text || "").toLowerCase();
  const candidates = [
    ...labelsArray.map(l => String(l).toLowerCase()),
    lowerText
  ];
  const eduMap = {
    "below 10th": "below 10th",
    "10th": "10th",
    "matric": "10th",
    "matriculation": "10th",
    "sslc": "10th",
    "12th": "12th",
    "intermediate": "12th",
    "hsc": "12th",
    "puc": "12th",
    "iti": "iti",
    "diploma": "diploma",
    "undergraduate": "graduate",
    "bachelor": "graduate",
    "graduate": "graduate",
    "post graduate": "post graduate",
    "postgraduate": "post graduate",
    "master": "post graduate",
    "masters": "post graduate",
    "phd": "phd",
    "doctorate": "phd",
    "professional": "professional",
    "all": "all"
  };
  for (const entry of candidates) {
    for (const [pattern, level] of Object.entries(eduMap)) {
      const regex = new RegExp(`\\b${pattern.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (regex.test(entry)) {
        levels.add(level);
      }
    }
  }
  if (levels.size === 0) levels.add("all");
  return Array.from(levels);
};

// ----- Gender: only female detection, else all -----
const parseGender = (labelsArray, text) => {
  const lcLabels = labelsArray.map(l => String(l).toLowerCase());
  const lcText = (text || "").toLowerCase();
  const femalePatterns = [
    "women", "woman", "female", "girl", "mother", "widow", "housewife",
    "grihini", "mahila", "ladki", "beti", "kanya", "bahu", "mata"
  ];
  const isFemale = lcLabels.some(l => femalePatterns.some(p => l.includes(p))) ||
    femalePatterns.some(p => lcText.includes(p));
  if (isFemale) {
    return { gender: "female", isFemaleOnly: true, allowedGenders: ["female"] };
  }
  return { gender: "all", isFemaleOnly: false, allowedGenders: ["all"] };
};

// ----- Scholarship patterns (FIXED: no backslash in variable name) -----
const SCHOLARSHIP_PATTERNS = [
  "scholarship", "fee reimbursement", "tuition fee", "student aid",
  "student support", "student welfare", "stipend", "post matric",
  "pre matric", "jee", "neet", "gate", "upsc", "fellowship",
  "studentship", "education loan", "vidyadhan", "pratibha",
  "merit cum means", "free education", "freeship", "grant"
];

export const normalizeMyScheme = (detailData, searchFields = {}) => {
  if (!detailData) return null;
  const basic = detailData.basicDetails || {};
  const content = detailData.schemeContent || {};
  const eligibilityObj = detailData.eligibilityCriteria || {};

  // ✅ Fixed: no backslash in _id
  const externalId = searchFields.slug || basic.schemeSlug || detailData._id;
  if (!externalId) return null;

  const name = (basic.schemeName || "Untitled Scheme").trim();
  const description = (content.briefDescription || "").trim();
  const benefits = extractBenefitsText(content);
  const eligibility = extractEligibility(eligibilityObj, basic);
  const tags = normalizeTags(basic.tags);
  const combinedText = `${name} ${description} ${eligibility}`.toLowerCase(); // ✅ no ** around template

  const category = basic.schemeCategory?.length
    ? basic.schemeCategory.map(c => (c.label || c)).join(", ")
    : "General";

  const ministry =
    (typeof basic.nodalMinistryName === "string" ? basic.nodalMinistryName : basic.nodalMinistryName?.label) ||
    (typeof basic.nodalDepartmentName === "string" ? basic.nodalDepartmentName : basic.nodalDepartmentName?.label) ||
    "Central Government";

  // ---------- State extraction ----------
  let rawState = "All India";
  const allowedStates = [];
  const extractStateList = (source) => {
    if (!source) return [];
    if (Array.isArray(source)) {
      return source.filter(Boolean).map(s => String(s).trim()).filter(s => s && s !== "All India" && s !== "all");
    }
    if (typeof source === "string" && source.trim()) {
      const trimmed = source.trim();
      return (trimmed !== "All India" && trimmed !== "all") ? [trimmed] : [];
    }
    return [];
  };

  const stateCandidates = [
    ...extractStateList(basic.allowedStates),
    ...extractStateList(searchFields.beneficiaryState),
    ...extractStateList(basic.state)
  ];
  const uniqueValid = [...new Set(stateCandidates)];
  if (uniqueValid.length > 0) {
    const normalizedStates = uniqueValid.map(s => normalizeState(s)).filter(Boolean);
    rawState = normalizedStates.join(", ");
    for (const state of normalizedStates) {
      const cleaned = state.toLowerCase().replace(/\s/g, "").trim();
      if (cleaned && !allowedStates.includes(cleaned)) {
        allowedStates.push(cleaned);
      }
    }
  }
  if (allowedStates.length === 0) {
    allowedStates.push("all");
  }

  // ---------- Categories ----------
  const targetBeneficiaries = basic.targetBeneficiaries || [];
  const beneficiaryLabels = targetBeneficiaries.map(b => (b.label || b).toLowerCase().trim());
  const allowedCategories = new Set();
  const categoryPatterns = {
    sc: [
      "sc", "scheduled caste", "dalit", "charmakar", "dhor", "chambhar", "mochi",
      "holar", "mahad", "mahar", "mang", "madiga", "adidravida"
    ],
    st: ["st", "scheduled tribe", "tribal", "adivasi", "gond", "santhal", "koya"],
    obc: ["obc", "other backward class", "backward class", "bc", "other backward community"],
    minority: ["minority", "muslim", "christian", "sikh", "jain", "buddhist", "parsi", "religious minority"],
    ews: ["ews", "economically weaker"]
  };

  for (const [cat, patterns] of Object.entries(categoryPatterns)) {
    const found = patterns.some(p => {
      const pLower = p.toLowerCase();
      const regex = new RegExp(`\\b${pLower.replace(/\s+/g, '\\s+')}\\b`, 'i'); // ✅ no **
      return beneficiaryLabels.some(l => regex.test(l)) ||
        regex.test(combinedText);
    });
    if (found) {
      allowedCategories.add(cat);
    }
  }
  if (allowedCategories.size === 0) allowedCategories.add("general");
  const finalAllowedCategories = Array.from(allowedCategories);

  // ---------- Occupations (with word boundaries) ----------
  const occSet = new Set();
  const occMap = {
    farmer: ["farmer", "kisan", "agricultur", "cultivator"],
    student: ["student", "vidyarthi", "pupil"],
    worker: ["worker", "labour", "mazdoor", "shramik", "daily wage"],
    startup: ["entrepreneur", "startup", "shop", "udyami", "self employed"],
    unemployed: ["unemployed", "berozgaar", "jobless"],
    housewife: ["housewife", "homemaker", "grihini"],
    widow: ["widow", "vidhwa"],
    artisan: ["artisan", "weaver", "handicraft", "potter"],
    fisherman: ["fisherman", "fisher", "machhuara"],
  };

  for (const [occ, patterns] of Object.entries(occMap)) {
    const found = patterns.some(p => {
      const regex = new RegExp(`\\b${p.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return beneficiaryLabels.some(l => regex.test(l)) ||
        regex.test(combinedText);
    });
    if (found) {
      occSet.add(occ);
    }
  }
  if (occSet.size === 0) occSet.add("all");
  const allowedOccupations = Array.from(occSet);

  // ---------- Scholarship (with word boundaries) ----------
  const isScholarship = SCHOLARSHIP_PATTERNS.some(p => {   // ✅ no backslash in variable name
    const regex = new RegExp(`\\b${p.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return regex.test(combinedText);
  });

  const schemeFor = basic.schemeFor || "Individual";
  const schemeType = basic.type || "General";

  // ---------- Age (FIXED: clean regex, no markdown) ----------
  let minAge = null, maxAge = null;
  const ageObj = searchFields.age || basic.age;
  if (ageObj && typeof ageObj === "object") {
    for (const key of Object.keys(ageObj)) {
      const range = ageObj[key];
      if (range) {
        if (range.gte != null) minAge = minAge === null ? range.gte : Math.min(minAge, range.gte);
        if (range.lte != null) maxAge = maxAge === null ? range.lte : Math.max(maxAge, range.lte);
      }
    }
  }

  if (eligibility) {
    const maxAgeMatch = eligibility.match(
      /\b(?:below|under|not exceeding|upto|at most|maximum)\s+(\d+)\s*years?/i
    );

    if (maxAgeMatch) {
      const parsedMax = parseInt(maxAgeMatch[1], 10);
      maxAge = maxAge !== null
        ? Math.min(maxAge, parsedMax)
        : parsedMax;
    }

    const minAgeMatch = eligibility.match(
      /\b(?:above|over|at least|minimum)\s+(\d+)\s*years?/i
    );

    if (minAgeMatch) {
      const parsedMin = parseInt(minAgeMatch[1], 10);
      minAge = minAge !== null
        ? Math.max(minAge, parsedMin)
        : parsedMin;
    }
  }

  // ---------- Income ----------
  const maxIncome = parseIncome(searchFields.familyIncomeLimit || basic.familyIncomeLimit);

  // ---------- Education ----------
  const educationLabels = (basic.educationLevel || []).map(e => (e.label || e));
  const educationLevels = parseEducationLevels(educationLabels, eligibility + " " + description);
  const primaryEducation = educationLevels[0];

  // ---------- Gender ----------
  const genderInfo = parseGender(beneficiaryLabels, combinedText + " " + (tags || []).join(" "));

  // ---------- Documents ----------
  let documentsRequired = null;
  if (Array.isArray(eligibilityObj.documentsRequired)) {
    documentsRequired = eligibilityObj.documentsRequired.map(d => (d.label || d)).filter(Boolean);
  } else if (typeof eligibilityObj.documentsRequired === "string") {
    documentsRequired = eligibilityObj.documentsRequired.split(",").map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(content.documentsRequired)) {
    documentsRequired = content.documentsRequired.map(d => (d.label || d)).filter(Boolean);
  } else if (typeof content.documentsRequired === "string") {
    documentsRequired = content.documentsRequired.split(",").map(s => s.trim()).filter(Boolean);
  }

  // ---------- searchText ----------
  const searchText = [
    name,
    description,
    content.detailedDescription_md || "",
    benefits,
    eligibility,
    tags.join(" "),
    beneficiaryLabels.join(" "),
    `category: ${category}`,
    `ministry: ${ministry}`,
    `state: ${rawState}`,
    `states: ${allowedStates.join(" ")}`,
    `type: ${schemeType}`,
    `for: ${schemeFor}`,
    `eligible occupations: ${Array.from(occSet).join(" ")}`,
    `eligible categories: ${finalAllowedCategories.join(" ")}`,
    `education: ${educationLevels.join(" ")}`,
    `gender: ${genderInfo.gender}`,
    isScholarship ? "scholarship education financial assistance" : "",
  ].join(" ").toLowerCase().replace(/\s+/g, " ").trim();

  // ---------- Final object ----------
  const normalized = {
    externalId: String(externalId).trim(),
    name,
    description,
    benefits,
    eligibility,
    category,
    ministry,
    state: rawState,
    occupation: allowedOccupations[0],
    educationLevel: primaryEducation,
    gender: genderInfo.gender,
    allowedCategories: finalAllowedCategories,
    allowedStates,
    allowedGenders: genderInfo.allowedGenders,
    allowedOccupations,
    allowedEducationLevels: educationLevels,
    minIncome: null,
    maxIncome,
    minAge,
    maxAge,
    isScholarship,
    isFemaleOnly: genderInfo.isFemaleOnly,
    schemeFor,
    applicationLink: searchFields.applicationLink || basic.applicationLink || null,
    sourceUrl: searchFields.sourceUrl || basic.sourceUrl || null,
    documentsRequired,
    searchText,
    tags,
  };

  const checksum = crypto
    .createHash("md5")
    .update(stableStringify(normalized))
    .digest("hex");

  return { ...normalized, sourceId: "myscheme", checksum };
};