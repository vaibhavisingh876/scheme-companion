import test from "node:test";
import assert from "node:assert/strict";
import { buildSchemeFilters } from "../src/services/filterBuilder.js";

test("manual filters still build active-scheme AND conditions", () => {
  const filters = buildSchemeFilters({
    gender: "female",
    state: "Delhi",
    income: 300000,
    casteCategory: "obc",
    educationLevel: "higher_education",
    occupation: "student",
  });

  assert.equal(filters.AND[0].isActive, true);
  const serialized = JSON.stringify(filters);
  assert.match(serialized, /"allowedGenders":\{"has":"female"\}/);
  assert.match(serialized, /"allowedStates":\{"has":"delhi"\}/);
  assert.match(serialized, /"maxIncome":\{"gte":300000\}/);
  assert.match(serialized, /"allowedCategories":\{"has":"obc"\}/);
});

test("occupation is only applied in strict mode", () => {
  const loose = buildSchemeFilters({ occupation: "student" });
  assert.doesNotMatch(JSON.stringify(loose), /allowedOccupations/);

  const strict = buildSchemeFilters({ occupation: "student" }, { strictOccupation: true });
  assert.match(JSON.stringify(strict), /"allowedOccupations":\{"has":"student"\}/);
});

test("unknown/empty profile values add no restrictions", () => {
  const filters = buildSchemeFilters({ gender: "unknown", state: "unknown", income: null });
  assert.equal(filters.AND.length, 1);
});
