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
  if (str.includes("crore")) return Math.round(parseFloat(str) * 10000000);
  if (str.includes("lakh")) return Math.round(parseFloat(str) * 100000);
  const parsed = parseInt(str.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Normalize a scheme using the full detail endpoint data + search summary fields.
 *
 * @param {object} detailData - The `data.en` object from /schemes/v6/public/schemes
 * @param {object} searchFields - The `fields` object from the search endpoint hit
 * @returns {object|null} Normalized scheme ready for DB insert
 */
export const normalizeMyScheme = (detailData, searchFields = {}) => {
  if (!detailData) return null;

  const basic = detailData.basicDetails || {};
  const content = detailData.schemeContent || {};
  const eligibilityObj = detailData.eligibilityCriteria || {};

  const externalId = searchFields.slug || basic.schemeSlug || detailData._id;
  if (!externalId) return null;

  const name = (basic.schemeName || "Untitled Scheme").trim();

  // Description: use briefDescription from content (most reliable)
  const description = (content.briefDescription || "").trim();

  // Benefits: prefer benefits_md, else detailedDescription_md, else empty
  const benefits = (
    content.benefits_md ||
    (Array.isArray(content.benefits)
      ? content.benefits.map(b => b.children?.map(c => c.text).join(" ")).join(" ")
      : "") ||
    content.detailedDescription_md ||
    ""
  ).trim();

  // Eligibility
  const eligibility = (eligibilityObj.eligibilityDescription_md || "").trim();

  // Tags
  const tags = normalizeTags(basic.tags);

  // Category – take first label
  const category = basic.schemeCategory?.length
    ? basic.schemeCategory[0].label
    : "General";

  const ministry =
    basic.nodalMinistryName?.label ||
    basic.nodalDepartmentName?.label ||
    "Central Government";

  // State – from search fields (beneficiaryState) because detail doesn't carry it
  let rawState = "All India";
  if (Array.isArray(searchFields.beneficiaryState)) {
    rawState = searchFields.beneficiaryState[0] || "All India";
  } else if (typeof searchFields.beneficiaryState === "string") {
    rawState = searchFields.beneficiaryState;
  }

  const allowedStates = [];
  if (rawState && rawState !== "All India") {
    allowedStates.push(rawState.toLowerCase().replace(/\s/g, "").trim());
  } else {
    allowedStates.push("all");
  }

  // Target Beneficiaries → allowedCategories, isFemaleOnly, allowedOccupations
  const targetBeneficiaries = basic.targetBeneficiaries || [];
  const beneficiaryLabels = targetBeneficiaries.map(b => b.label.toLowerCase().trim());

  const allowedCategories = [];
  const isFemaleOnly = beneficiaryLabels.includes("women") ||
                       beneficiaryLabels.includes("female") ||
                       beneficiaryLabels.includes("girl");

  if (beneficiaryLabels.includes("sc") || beneficiaryLabels.includes("scheduled caste")) allowedCategories.push("sc");
  if (beneficiaryLabels.includes("st") || beneficiaryLabels.includes("scheduled tribe")) allowedCategories.push("st");
  if (beneficiaryLabels.includes("obc") || beneficiaryLabels.includes("other backward class")) allowedCategories.push("obc");
  if (beneficiaryLabels.includes("minority") || beneficiaryLabels.includes("muslim") || beneficiaryLabels.includes("christian") || beneficiaryLabels.includes("sikh") || beneficiaryLabels.includes("jain") || beneficiaryLabels.includes("buddhist") || beneficiaryLabels.includes("parsi")) allowedCategories.push("minority");
  if (allowedCategories.length === 0) allowedCategories.push("general");

  // Occupation detection from beneficiary labels and scheme name/description
  const occSet = new Set();
  const textForOcc = `${name} ${description}`.toLowerCase();
  if (beneficiaryLabels.includes("farmer") || /farmer|kisan/i.test(textForOcc)) occSet.add("farmer");
  if (beneficiaryLabels.includes("student") || /student|scholarship/i.test(textForOcc)) occSet.add("student");
  if (beneficiaryLabels.includes("worker") || /worker|labour|mazdoor/i.test(textForOcc)) occSet.add("worker");
  if (beneficiaryLabels.includes("entrepreneur") || /startup|business|shop/i.test(textForOcc)) occSet.add("startup");
  if (beneficiaryLabels.includes("unemployed") || /unemployed|berozgaar/i.test(textForOcc)) occSet.add("unemployed");
  if (beneficiaryLabels.includes("housewife") || /housewife|homemaker|grihini/i.test(textForOcc)) occSet.add("housewife");
  if (beneficiaryLabels.includes("widow") || /widow|vidhwa/i.test(textForOcc)) occSet.add("widow");
  if (occSet.size === 0) occSet.add("all");
  const allowedOccupations = Array.from(occSet);

  // Scheme For
  const schemeFor = basic.schemeFor || "Individual";

  // Age from structured field
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

  // Income
  const maxIncome = parseIncome(searchFields.familyIncomeLimit || basic.familyIncomeLimit);

  // isScholarship
  const isScholarship = /\bscholarship\b|fee reimbursement|tuition fee|student (aid|support)|stipend|post.?matric|pre.?matric|jee\b|neet\b|gate\b|upsc\b/i.test(textForOcc);

  // Build a rich searchText from all textual fields
  const searchText = [
    name,
    description,
    content.detailedDescription_md || "",
    benefits,
    eligibility,
    tags.join(" "),
    `category: ${category}`,
    `state: ${rawState}`,
    isScholarship ? "scholarship education financial assistance" : "",
  ].join(" ").toLowerCase().replace(/\s+/g, " ").trim();

  const normalized = {
    externalId: String(externalId).trim(),
    name,
    description,
    benefits,
    eligibility,
    category,
    ministry,
    state: rawState,
    occupation: "all citizens",
    educationLevel: "all",
    gender: "all",
    allowedCategories,
    allowedStates,
    allowedGenders: ["all"],
    allowedOccupations,
    allowedEducationLevels: ["all"],
    minIncome: null,
    maxIncome,
    minAge,
    maxAge,
    isScholarship,
    isFemaleOnly,
    schemeFor,
    applicationLink: searchFields.applicationLink || basic.applicationLink || null,
    sourceUrl: searchFields.sourceUrl || basic.sourceUrl || null,
    documentsRequired: null,
    searchText,
    tags,
  };

  const checksum = crypto
    .createHash("md5")
    .update(stableStringify(normalized))
    .digest("hex");

  return { ...normalized, sourceId: "myscheme", checksum };
};