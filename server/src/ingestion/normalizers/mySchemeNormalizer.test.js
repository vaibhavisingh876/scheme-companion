import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMyScheme } from "./mySchemeNormalizer.js";
import { addEmptyLegacyEligibilityFields } from "../sync/myschemeSync.js";
import { buildSchemeFilters } from "../../services/filterBuilder.js";

test("preserves the original MyScheme eligibility description verbatim", async () => {
  const rawEligibility = "Applicants must be 18–35 years old.\n\nIncome < ₹2,00,000.";
  const normalized = await normalizeMyScheme({
    slug: "sample-scheme",
    basicDetails: { schemeName: "Sample" },
    eligibilityCriteria: { eligibilityDescription_md: rawEligibility },
    schemeContent: { exclusions: "Other API section" },
  });
  assert.equal(normalized.eligibility, rawEligibility);
});

test("does not derive eligibility restrictions from raw eligibility text", async () => {
  const normalized = await normalizeMyScheme({
    basicDetails: { schemeName: "Women farmer scholarship" },
    eligibilityCriteria: {
      eligibilityDescription_md: "Women aged 18 to 25 with annual income below ₹2 lakh; SC farmers only.",
    },
  });
  for (const key of [
    "gender", "occupation", "educationLevel", "allowedCategories", "allowedGenders",
    "allowedOccupations", "allowedEducationLevels", "minIncome", "maxIncome", "minAge",
    "maxAge", "isFemaleOnly",
  ]) assert.equal(Object.hasOwn(normalized, key), false, `${key} should not be inferred by normalizer`);
});

test("continues normalizing non-eligibility metadata", async () => {
  const normalized = await normalizeMyScheme({
    slug: "sample-scheme",
    basicDetails: {
      schemeName: "Sample Scheme",
      briefDescription: "Short description",
      state: { label: "Tamil Nadu" },
      schemeCategory: [{ label: "Education" }],
      nodalMinistryName: { label: "Ministry of Education" },
      schemeFor: "Students",
    },
    schemeContent: { benefits: "Tuition support", documentsRequired: "Aadhaar" },
    tags: ["Education"],
  });
  assert.equal(normalized.name, "Sample Scheme");
  assert.equal(normalized.description, "Short description");
  assert.equal(normalized.benefits, "Tuition support");
  assert.equal(normalized.category, "Education");
  assert.equal(normalized.ministry, "Ministry of Education");
  assert.equal(normalized.state, "tamilnadu");
  assert.equal(normalized.sourceId, "myscheme");
  assert.equal(normalized.externalId, "sample-scheme");
  assert.equal(normalized.sourceUrl, "https://www.myscheme.gov.in/schemes/sample-scheme");
  assert.equal(normalized.applicationLink, null);
  assert.deepEqual(normalized.tags, ["education"]);
});

test("new ingestion supplies permissive legacy defaults and manual search keeps working", () => {
  const scheme = addEmptyLegacyEligibilityFields({ name: "New scheme" });
  assert.deepEqual(scheme.allowedCategories, []);
  assert.deepEqual(scheme.allowedGenders, []);
  assert.deepEqual(scheme.allowedOccupations, []);
  assert.deepEqual(scheme.allowedEducationLevels, []);
  assert.equal(scheme.minAge, null);
  assert.equal(scheme.maxIncome, null);
  const where = buildSchemeFilters({
    gender: "male", state: "tamilnadu", occupation: "farmer",
    educationLevel: "undergraduate", income: 100000, casteCategory: "general",
  }, { strictOccupation: true });
  assert.ok(Array.isArray(where.AND));
  assert.ok(where.AND.length > 1);
});
