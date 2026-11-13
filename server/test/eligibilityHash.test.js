import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceHashOf,
  eligibilitySourceChanged,
} from "../src/services/ai/recommendation/eligibilityHash.js";

test("sourceHashOf is stable across whitespace changes", () => {
  const a = sourceHashOf("Applicant must be a female student.");
  const b = sourceHashOf("  Applicant   must be a female\nstudent.  ");
  assert.equal(a, b);
});

test("sourceHashOf changes when the eligibility text changes", () => {
  const a = sourceHashOf("Income below 3 lakh.");
  const b = sourceHashOf("Income below 5 lakh.");
  assert.notEqual(a, b);
});

test("eligibilitySourceChanged detects only semantic text changes", () => {
  assert.equal(
    eligibilitySourceChanged("Age 18-35 years", "Age   18-35 years"),
    false
  );
  assert.equal(eligibilitySourceChanged("Age 18-35 years", "Age 18-40 years"), true);
  assert.equal(eligibilitySourceChanged(null, ""), false);
});
