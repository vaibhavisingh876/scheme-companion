import crypto from "crypto";

const stableStringify = (obj) => JSON.stringify(obj, Object.keys(obj).sort());

const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .filter(Boolean)
      .map((t) => String(t).toLowerCase().trim())
      .filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
};

const parseIncome = (value) => {
  if (!value) return null;

  const str = String(value).toLowerCase().trim();

  if (str.includes("crore")) {
    return Math.round(parseFloat(str) * 10000000);
  }

  if (str.includes("lakh")) {
    return Math.round(parseFloat(str) * 100000);
  }

  const parsed = parseInt(str.replace(/[^\d]/g, ""), 10);

  return Number.isNaN(parsed) ? null : parsed;
};

export const normalizeMyScheme = (raw) => {
  if (!raw) return null;

  const fields = raw?.fields || raw;
  const externalId = raw?.id || fields?.slug || fields?.schemeSlug;
  if (!externalId) return null;

  const name = (fields?.schemeName || "Untitled Scheme").trim();
  const description = (fields?.briefDescription || "").trim();
  const tags = normalizeTags(fields?.tags);
  const benefitsText = (fields?.benefits || "").trim();
  const eligibilityText = (fields?.eligibility || "").trim();

  const textBlob = `${name} ${description} ${benefitsText} ${eligibilityText} ${tags.join(" ")}`.toLowerCase();

  // ── 1. Occupations ────────────────────────────────────────────────────────
  const allowedOccupations = [];

  if (
    /student|scholarship|education|college|university|btech|degree|undergraduate|graduate|matric|school/i.test(
      textBlob
    )
  ) {
    allowedOccupations.push("student");
  }
  if (
    /farmer|agriculture|crop|kisan|cultivator|farming|horticulture/i.test(
      textBlob
    )
  ) {
    allowedOccupations.push("farmer");
  }
  if (
    /construction worker|worker|labour|labourer|mazdoor|shramik|artisan|mgnrega/i.test(
      textBlob
    )
  ) {
    allowedOccupations.push("worker");
  }
  if (
    /business owner|shop owner|merchant|trader|msme owner|entrepreneur|startup founder|self employed|self-employed|vyapar|dukaan/i.test(
      textBlob
    )
  ) {
    allowedOccupations.push("startup");
  }
  if (/housewife|homemaker|grihini/i.test(textBlob)) {
    allowedOccupations.push("housewife");
  }
  if (/jobless|unemployed|beroogzar/i.test(textBlob)) {
    allowedOccupations.push("unemployed");
  }
  if (allowedOccupations.length === 0) {
    allowedOccupations.push("all");
  }

  // ── 2. Education levels ───────────────────────────────────────────────────
  const allowedEducationLevels = [];

  if (
    /btech|engineering|college|university|undergraduate|graduate|degree|post graduate|masters|phd|fellowship/i.test(
      textBlob
    )
  ) {
    allowedEducationLevels.push("higher_education");
  }
  if (
    /class|school|10th|12th|pre matric|primary|secondary|matric/i.test(
      textBlob
    )
  ) {
    allowedEducationLevels.push("school");
  }
  if (allowedEducationLevels.length === 0) {
    allowedEducationLevels.push("all");
  }

  // ── 3. Genders ────────────────────────────────────────────────────────────
  // Word boundaries prevent "men" matching inside "treatment", "government", etc.
  const hasFemaleKeywords =
    /women|woman|\bgirl\b|female|maternity|pregnancy|widow|vidhwa|ladki|beti|mahila|daughter|mother|sister/i.test(
      textBlob
    );
  const hasMaleKeywords =
    /\bmen\b|\bmale\b|\bboy\b|ladka|\bbeta\b|\bbhai\b|\bfather\b|\bson\b|\bbrother\b/i.test(
      textBlob
    );

  const allowedGenders = [];
  if (hasFemaleKeywords && !hasMaleKeywords) {
    allowedGenders.push("female");
  } else if (hasMaleKeywords && !hasFemaleKeywords) {
    allowedGenders.push("male");
  } else {
    allowedGenders.push("male", "female", "other", "all");
  }

  const isFemaleOnly = allowedGenders.length === 1 && allowedGenders[0] === "female";

  // ── 4. Categories ─────────────────────────────────────────────────────────
  const allowedCategories = [];

  if (/\bsc\b|scheduled caste/i.test(textBlob)) allowedCategories.push("sc");
  if (/\bst\b|scheduled tribe/i.test(textBlob)) allowedCategories.push("st");
  if (/\bobc\b|backward class/i.test(textBlob)) allowedCategories.push("obc");
  if (/minority|muslim|sikh|christian|jain|buddhist|parsi/i.test(textBlob))
    allowedCategories.push("minority");
  if (
    allowedCategories.length === 0 ||
    /general|open category|everyone|all categories/i.test(textBlob)
  ) {
    allowedCategories.push("general", "sc", "st", "obc", "minority");
  }

  // ── 5. States ─────────────────────────────────────────────────────────────
  const allowedStates = [];
  let rawState = "All India";

  if (Array.isArray(fields?.beneficiaryState)) {
    rawState = fields.beneficiaryState[0] || "All India";
  } else if (typeof fields?.beneficiaryState === "string") {
    rawState = fields.beneficiaryState;
  }

  if (rawState && rawState !== "All India") {
    allowedStates.push(
      rawState.toLowerCase().replace(/\s/g, "").trim()
    );
  } else {
    allowedStates.push("all");
  }

  // ── 6. isScholarship ─────────────────────────────────────────────────────
  // "financial assistance" only counts when paired with education context.
  const isScholarship =
    /\bscholarship\b|fee reimbursement|tuition fee|education (assistance|grant|support|loan)|student (aid|support)|stipend|fellowship|merit (scholarship|award)|\bpost.?matric\b|\bpre.?matric\b|\bjee\b|\bneet\b|\bgate\b|\bupsc\b|coaching (fee|grant|support)|hostel (fee|subsidy|allowance)|entrance exam fee|exam fee waiver|training grant|financial assistance.{1,40}(education|student|college|school|study|tuition)|financial aid|education support|tuition support|student assistance/i.test(
      textBlob
    );

  // ── Income / Age ──────────────────────────────────────────────────────────
  const minAge = fields?.minimumAge ? parseInt(fields.minimumAge, 10) : null;
  const maxAge = fields?.maximumAge ? parseInt(fields.maximumAge, 10) : null;
  const maxIncome = parseIncome(fields?.familyIncomeLimit);

  // ── searchText (used for embedding) ──────────────────────────────────────
  const searchText = `
${name}
${description}
${benefitsText}
${eligibilityText}
occupation: ${allowedOccupations.join(" ")}
education: ${allowedEducationLevels.join(" ")}
gender: ${allowedGenders.join(" ")}
category: ${allowedCategories.join(" ")}
state: ${allowedStates.join(" ")}
tags: ${tags.join(" ")}
${isScholarship ? "scholarship education student financial assistance stipend fee reimbursement" : ""}
  `.toLowerCase();

  const normalized = {
    externalId: String(externalId).trim(),
    name,
    description,
    benefits: benefitsText,
    eligibility: eligibilityText,
    category: fields?.schemeCategory?.[0] || "General",
    ministry: fields?.nodalMinistryName || "Central Government",
    state: rawState,
    occupation: allowedOccupations[0] || "all citizens",
    educationLevel: allowedEducationLevels[0] || "all",
    gender: allowedGenders.length > 2 ? "all" : allowedGenders[0],
    allowedCategories,
    allowedStates,
    allowedGenders,
    allowedOccupations,
    allowedEducationLevels,
    minIncome: null,
    maxIncome,
    minAge,
    maxAge,
    isScholarship,
    isFemaleOnly,
    applicationLink: fields?.applicationLink || null,
    sourceUrl: fields?.sourceUrl || null,
    documentsRequired: fields?.documentsRequired || null,
    searchText,
  };

  const checksum = crypto
    .createHash("md5")
    .update(stableStringify(normalized))
    .digest("hex");

  return { ...normalized, sourceId: "myscheme", checksum };
};