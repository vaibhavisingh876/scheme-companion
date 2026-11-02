import crypto from "crypto";

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
  "dadra and nagar haveli and daman and diu": "dadranagarhavelianddamananddiu",
  "dadra & nagar haveli and daman & diu": "dadranagarhavelianddamananddiu",
  lakshadweep: "lakshadweep",
  "andaman and nicobar islands": "andamanandnicobarislands",
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

const extractRichText = (node, preserveRaw = false) => {
  if (typeof node === "string") return preserveRaw ? node : normalizeText(node);
  if (Array.isArray(node)) return node.map((item) => extractRichText(item, preserveRaw)).filter(Boolean).join("\n");
  if (!node || typeof node !== "object") return "";
  const parts = [];
  if (node.text) parts.push(String(node.text));
  if (node.children) parts.push(extractRichText(node.children, preserveRaw));
  if (node.content) parts.push(extractRichText(node.content, preserveRaw));
  if (node.value) parts.push(String(node.value));
  const result = parts.filter(Boolean).join("\n");
  return preserveRaw ? result : normalizeText(result);
};

// Keep the API's eligibility description verbatim whenever it is supplied as
// text. Rich-text payloads are serialized without cleaning or rule extraction.
const extractEligibility = (detail) => {
  const criteria = detail?.eligibilityCriteria;
  const eligibility = criteria?.eligibilityDescription_md ??
    criteria?.eligibilityDescription ?? criteria;
  return extractRichText(eligibility, true);
};

const normalizeTags = (tags) => Array.isArray(tags)
  ? tags.map(normalizeText).filter(Boolean).map((tag) => tag.toLowerCase())
  : [];

const extractBenefitsText = (detail) => {
  const benefits = detail?.schemeContent?.benefits;
  return typeof benefits === "string" ? normalizeText(benefits) : extractRichText(benefits);
};

const extractDocumentsText = (detail) => {
  const content = detail?.schemeContent;
  if (content?.documentsRequired_md) return normalizeText(content.documentsRequired_md);
  if (typeof content?.documentsRequired === "string") return normalizeText(content.documentsRequired);
  return extractRichText(content?.documentsRequired);
};

const normalizeState = (state) => {
  if (!state) return "all";
  const normalized = normalizeText(state).toLowerCase();
  return stateMap[normalized] || normalized.replace(/[^a-z0-9]/g, "");
};

const extractStateList = (detail, fallback = {}) => {
  const states = new Set();
  const basicState = detail?.basicDetails?.state?.label || detail?.basicDetails?.state?.name;
  if (basicState) states.add(normalizeState(basicState));
  for (const state of Array.isArray(fallback?.beneficiaryState) ? fallback.beneficiaryState : []) {
    if (state && normalizeText(state).toLowerCase() !== "all") states.add(normalizeState(state));
  }
  return states.size ? [...states] : ["all"];
};

const extractApplicationLink = (detail) => {
  const process = detail?.schemeContent?.applicationProcess;
  if (Array.isArray(process)) {
    for (const item of process) if (item?.url || item?.link) return item.url || item.link;
  }
  return detail?.applicationLink || null;
};

const detectScholarship = (name, tags) => /\bscholarships?\b/i.test(`${name || ""} ${tags.join(" ")}`);

export const normalizeMyScheme = async (detail, searchFields = {}) => {
  if (!detail) return null;
  const basicDetails = detail.basicDetails || {};
  const name = basicDetails.schemeName || searchFields.schemeName || "";
  const description = normalizeText(
    basicDetails.briefDescription || basicDetails.description || searchFields.briefDescription || ""
  );
  const eligibility = extractEligibility(detail);
  const tags = normalizeTags(detail.tags || basicDetails.tags || searchFields.tags || []);
  const benefits = extractBenefitsText(detail);
  const allowedStates = extractStateList(detail, searchFields);
  const rawCategory = searchFields.schemeCategory?.[0] || basicDetails.schemeCategory?.[0] || "all";
  const category = rawCategory && typeof rawCategory === "object"
    ? rawCategory.label || rawCategory.name || rawCategory.value || "all"
    : rawCategory;
  const ministryValue = basicDetails.nodalMinistryName || searchFields.nodalMinistryName || "Central Government";
  const ministry = ministryValue && typeof ministryValue === "object"
    ? ministryValue.label || ministryValue.name || ministryValue.value || "Central Government"
    : ministryValue;
  const schemeFor = basicDetails.schemeFor || searchFields.schemeFor || "Individual";
  const externalId = detail.slug || basicDetails.slug || searchFields.slug || "";
  const applicationLink = extractApplicationLink(detail);
  const sourceUrl = externalId ? `https://www.myscheme.gov.in/schemes/${externalId}` : null;
  const isScholarship = detectScholarship(name, tags);

  // Restriction columns remain in the legacy schema for manual search and old
  // records. New normalized records intentionally carry no inferred rules.
  const normalizedForChecksum = {
    name, description, benefits, eligibility, category, ministry, allowedStates,
    isScholarship, tags, schemeFor,
  };
  const checksum = crypto.createHash("sha256").update(JSON.stringify(normalizedForChecksum)).digest("hex");

  return {
    externalId, name, description, benefits, eligibility, category, ministry,
    state: allowedStates[0] || "all",
    allowedStates,
    isScholarship,
    schemeFor, applicationLink, sourceUrl,
    documentsRequired: extractDocumentsText(detail),
    tags,
    sourceId: "myscheme",
    checksum,
  };
};
