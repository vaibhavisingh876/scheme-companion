import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyEligibility,
  verifySchemeEligibility,
  columnsToRules,
} from "../src/services/ai/recommendation/verification.js";

const profile = {
  age: 25,
  gender: "female",
  income: 200000,
  state: "delhi",
  casteCategory: "obc",
  occupation: "student",
  educationLevel: "higher_education",
};

const emptyRules = {
  age: null,
  gender: null,
  minAnnualIncome: null,
  maxAnnualIncome: null,
  state: null,
  casteCategory: null,
  occupation: null,
  educationLevel: null,
  maritalStatus: null,
  residency: null,
  unknownCriteria: [],
};

test("no rules means unknown, never eligible", () => {
  assert.equal(verifyEligibility(null, profile).status, "unknown");
  assert.equal(verifyEligibility(emptyRules, profile).status, "unknown");
});

test("age limits are hard: mismatch excludes, match confirms", () => {
  const tooYoung = verifyEligibility({ ...emptyRules, age: { min: 30, max: 40 } }, profile);
  assert.equal(tooYoung.status, "no_match");

  const inside = verifyEligibility({ ...emptyRules, age: { min: 18, max: 30 } }, profile);
  assert.equal(inside.status, "match");
});

test("a stated age limit with an unknown user age yields unknown", () => {
  const result = verifyEligibility(
    { ...emptyRules, age: { min: 18, max: 30 } },
    { ...profile, age: null }
  );
  assert.equal(result.status, "unknown");
});

test("gender mismatch is no_match; unknown gender is unknown", () => {
  const femaleOnly = { ...emptyRules, gender: ["female"] };
  assert.equal(verifyEligibility(femaleOnly, profile).status, "match");
  assert.equal(
    verifyEligibility(femaleOnly, { ...profile, gender: "male" }).status,
    "no_match"
  );
  assert.equal(
    verifyEligibility(femaleOnly, { ...profile, gender: "unknown" }).status,
    "unknown"
  );
});

test("income ceiling excludes above-limit users and stays unknown without income", () => {
  const rules = { ...emptyRules, maxAnnualIncome: 100000 };
  assert.equal(verifyEligibility(rules, profile).status, "no_match");
  assert.equal(verifyEligibility(rules, { ...profile, income: null }).status, "unknown");
});

test("state rules normalise formatting before comparing", () => {
  const rules = { ...emptyRules, state: ["Delhi"] };
  assert.equal(verifyEligibility(rules, profile).status, "match");
  assert.equal(
    verifyEligibility(rules, { ...profile, state: "bihar" }).status,
    "no_match"
  );
});

test("reserved-category rules exclude non-listed categories", () => {
  const scOnly = { ...emptyRules, casteCategory: ["sc"] };
  assert.equal(verifyEligibility(scOnly, profile).status, "no_match");
  assert.equal(
    verifyEligibility(scOnly, { ...profile, casteCategory: "sc" }).status,
    "match"
  );
});

test("soft targeting mismatches stay unknown instead of excluding", () => {
  const farmerOnly = { ...emptyRules, occupation: ["farmer"] };
  const result = verifyEligibility(farmerOnly, profile);
  assert.equal(result.status, "unknown");
  assert.ok(result.checks.some((check) => check.field === "occupation"));
});

test("unverified criteria keep the result unknown", () => {
  const result = verifyEligibility(
    {
      ...emptyRules,
      age: { min: 18, max: 30 },
      unknownCriteria: ["must be a resident for five years"],
    },
    profile
  );
  assert.equal(result.status, "unknown");
});

test("a hard failure outranks an unknown criterion", () => {
  const result = verifyEligibility(
    {
      ...emptyRules,
      age: { min: 40, max: 60 },
      income: 100000,
      maxAnnualIncome: 100000,
      unknownCriteria: ["must not have availed earlier"],
    },
    profile
  );
  assert.equal(result.status, "no_match");
});

test("columnsToRules derives female-only from isFemaleOnly", () => {
  const rules = columnsToRules({ isFemaleOnly: true, name: "X" });
  assert.deepEqual(rules.gender, ["female"]);
});

test("verifySchemeEligibility combines Groq rules and structured columns", () => {
  const scheme = {
    id: "1",
    name: "Scholarship",
    isFemaleOnly: true,
    maxIncome: 300000,
    eligibility: "Only female students with family income below 3 lakh.",
  };
  const result = verifySchemeEligibility(scheme, profile, {
    ...emptyRules,
    age: { min: 18, max: 30 },
  });
  assert.equal(result.status, "match");
  assert.deepEqual(result.sources.sort(), ["columns", "groq"]);
});

test("text heuristics only run when Groq rules are absent", () => {
  const scheme = {
    id: "2",
    name: "Widow Pension Scheme",
    description: "Financial assistance for widows.",
    eligibility: "Widows only.",
    tags: ["widow"],
  };
  const maleProfile = { ...profile, gender: "male" };

  const withoutGroq = verifySchemeEligibility(scheme, maleProfile);
  assert.equal(withoutGroq.status, "no_match");
  assert.ok(withoutGroq.sources.includes("heuristics"));

  const withGroq = verifySchemeEligibility(scheme, maleProfile, { ...emptyRules });
  assert.notEqual(withGroq.status, "no_match");
  assert.ok(!withGroq.sources.includes("heuristics"));
});

test("verifySchemeEligibility excludes confirmed column conflicts", () => {
  const scheme = {
    id: "3",
    name: "Men Only Scheme",
    gender: "male",
    allowedGenders: ["male"],
    eligibility: "For male applicants.",
  };
  const result = verifySchemeEligibility(scheme, profile);
  assert.equal(result.status, "no_match");
});
