import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibilityRulesSchema,
  normalizeRules,
} from "../src/validators/eligibilityRulesValidator.js";

const evidenceFor = (...fields) => ({
  sourceEvidence: fields.map((field) => ({ field, text: "source phrase" })),
});

test("accepts rules with explicit source evidence", () => {
  const parsed = eligibilityRulesSchema.safeParse({
    age: { min: 18, max: 35 },
    gender: ["female"],
    maxAnnualIncome: 300000,
    ...evidenceFor("age", "gender", "maxAnnualIncome"),
  });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.gender, ["female"]);
});

test("rejects populated fields that lack source evidence", () => {
  const parsed = eligibilityRulesSchema.safeParse({
    gender: ["female"],
    sourceEvidence: [],
  });
  assert.equal(parsed.success, false);
  assert.match(
    parsed.error.issues.map((issue) => issue.message).join(" "),
    /source evidence is required for populated field: gender/
  );
});

test("normalizeRules coerces LLM near-miss field names", () => {
  const normalized = normalizeRules({
    age_min: 18,
    ageMax: "60",
    genders: "female",
    max_family_income: "3 lakh",
    min_annual_income: "₹1,00,000",
    unknown_criteria: ["must not have availed earlier"],
    source_evidence: [
      { field: "gender", text: "only women" },
      { field: "age", text: "18-60 years" },
      { field: "maxAnnualIncome", text: "family income below 3 lakh" },
      { field: "minAnnualIncome", text: "income above 1 lakh" },
      { field: "unknownCriteria", text: "must not have availed earlier" },
    ],
  });

  const parsed = eligibilityRulesSchema.parse(normalized);
  assert.deepEqual(parsed.age, { min: 18, max: 60 });
  assert.deepEqual(parsed.gender, ["female"]);
  assert.equal(parsed.maxAnnualIncome, 300000);
  assert.equal(parsed.minAnnualIncome, 100000);
  assert.deepEqual(parsed.unknownCriteria, ["must not have availed earlier"]);
});

test("normalizeRules treats missing/null rules as empty", () => {
  assert.deepEqual(normalizeRules(null), {});
  assert.equal(normalizeRules({}).age, null);
});

test("schema truncates fractional ages and rejects out-of-range values", () => {
  const accepted = eligibilityRulesSchema.safeParse({
    age: { min: 18.9, max: 60 },
    ...evidenceFor("age"),
  });
  assert.equal(accepted.success, true);
  assert.equal(accepted.data.age.min, 18);

  const rejected = eligibilityRulesSchema.safeParse({
    age: { min: 18, max: 999 },
    ...evidenceFor("age"),
  });
  assert.equal(rejected.success, false);
});
