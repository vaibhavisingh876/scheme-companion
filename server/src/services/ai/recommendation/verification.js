// Deterministic eligibility VERIFICATION (kept separate from extraction).
// Input: extracted rules (from eligibilityService) + a user profile.
// Output: 'match' | 'no_match' | 'unknown' plus per-criterion detail.
//
// Design rules honored here:
//  - UNKNOWN is never treated as eligible. A stated criterion the profile
//    cannot confirm yields 'unknown', not 'match'.
//  - Only clear failures of HARD criteria produce 'no_match'. Soft/targeting
//    criteria (occupation, education, marital, residency) never hard-exclude,
//    because profile extraction may simply not capture them (avoids the
//    "incorrect exclusions" the design warns about).

const normState = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const ALL_TOKENS = new Set(["all", "allindia", "any", "everyone"]);

const push = (checks, field, result, reason) => checks.push({ field, result, reason });

/**
 * @param {object|null} rules validated extractedRules (or null)
 * @param {object} profile extracted user profile
 * @returns {{status:'match'|'no_match'|'unknown', checks:Array, unknownCriteria:Array}}
 */
export const verifyEligibility = (rules, profile) => {
  if (!rules || typeof rules !== "object") {
    // No rules available (extraction missing/failed/no eligibility text).
    return { status: "unknown", checks: [], unknownCriteria: [], reason: "no_rules" };
  }

  const checks = [];
  const unknownCriteria = Array.isArray(rules.unknownCriteria) ? rules.unknownCriteria : [];

  // ── AGE (hard) ────────────────────────────────────────────────
  const age = rules.age;
  if (age && (age.min != null || age.max != null)) {
    if (profile.age == null) {
      push(checks, "age", "unknown", "scheme states an age limit but user age is unknown");
    } else {
      if (age.min != null && profile.age < age.min) push(checks, "age", "no_match", `age ${profile.age} below min ${age.min}`);
      else if (age.max != null && profile.age > age.max) push(checks, "age", "no_match", `age ${profile.age} above max ${age.max}`);
      else push(checks, "age", "match", `age ${profile.age} within ${age.min ?? "*"}-${age.max ?? "*"}`);
    }
  }

  // ── GENDER (hard) ─────────────────────────────────────────────
  const gender = Array.isArray(rules.gender) ? rules.gender.map((g) => String(g).toLowerCase()) : null;
  if (gender && gender.length && !gender.some((g) => ALL_TOKENS.has(g))) {
    const userGender = String(profile.gender || "unknown").toLowerCase();
    if (userGender === "unknown" || userGender === "other") {
      push(checks, "gender", "unknown", "scheme restricts gender but user gender not established");
    } else if (gender.includes(userGender)) {
      push(checks, "gender", "match", `user gender ${userGender} allowed`);
    } else {
      push(checks, "gender", "no_match", `scheme limited to ${gender.join("/")} but user is ${userGender}`);
    }
  }

  // ── INCOME (hard) ─────────────────────────────────────────────
  const hasIncomeRule = rules.maxAnnualIncome != null || rules.minAnnualIncome != null;
  if (hasIncomeRule) {
    if (profile.income == null) {
      push(checks, "income", "unknown", "scheme has an income limit but user income is unknown");
    } else {
      if (rules.maxAnnualIncome != null && profile.income > rules.maxAnnualIncome)
        push(checks, "income", "no_match", `income ${profile.income} above ceiling ${rules.maxAnnualIncome}`);
      else if (rules.minAnnualIncome != null && profile.income < rules.minAnnualIncome)
        push(checks, "income", "no_match", `income ${profile.income} below floor ${rules.minAnnualIncome}`);
      else push(checks, "income", "match", "income within stated limits");
    }
  }

  // ── STATE (hard) ──────────────────────────────────────────────
  const states = Array.isArray(rules.state) ? rules.state.map(normState) : null;
  if (states && states.length && !states.some((s) => ALL_TOKENS.has(s))) {
    const userState = normState(profile.state);
    if (!userState || userState === "unknown") {
      push(checks, "state", "unknown", "scheme is state-specific but user state is unknown");
    } else if (states.includes(userState)) {
      push(checks, "state", "match", `user state ${userState} covered`);
    } else {
      push(checks, "state", "no_match", `scheme limited to ${states.join("/")} but user is in ${userState}`);
    }
  }

  // ── CASTE / CATEGORY (hard) ───────────────────────────────────
  const cats = Array.isArray(rules.casteCategory) ? rules.casteCategory.map((c) => String(c).toLowerCase()) : null;
  if (cats && cats.length && !cats.some((c) => ALL_TOKENS.has(c))) {
    const userCat = String(profile.casteCategory || "unknown").toLowerCase();
    if (userCat === "unknown") {
      push(checks, "casteCategory", "unknown", "scheme reserves categories but user category is unknown");
    } else if (cats.includes(userCat) || cats.includes("general")) {
      push(checks, "casteCategory", "match", `user category ${userCat} allowed`);
    } else {
      push(checks, "casteCategory", "no_match", `scheme limited to ${cats.join("/")} but user is ${userCat}`);
    }
  }

  // ── SOFT / TARGETING criteria (mismatch => unknown, never no_match) ──
  const softArrayRule = (field, values, userValue) => {
    const arr = Array.isArray(values) ? values.map((v) => String(v).toLowerCase()) : null;
    if (!arr || !arr.length || arr.some((v) => ALL_TOKENS.has(v))) return;
    const uv = String(userValue || "").toLowerCase();
    if (!uv || uv === "unknown") {
      push(checks, field, "unknown", `scheme targets ${arr.join("/")} but user ${field} not established`);
    } else if (arr.some((v) => uv.includes(v) || v.includes(uv))) {
      push(checks, field, "match", `user ${field} ${uv} aligns`);
    } else {
      push(checks, field, "unknown", `user ${field} ${uv} not among targeted ${arr.join("/")} (not hard-excluding)`);
    }
  };

  softArrayRule("occupation", rules.occupation, profile.occupation);
  softArrayRule("educationLevel", rules.educationLevel, profile.educationLevel === "higher_education" ? "undergraduate" : profile.educationLevel);
  softArrayRule("maritalStatus", rules.maritalStatus, profile.occupation === "widow" ? "widowed" : "unknown");
  softArrayRule("residency", rules.residency, "unknown");

  // Residual non-machine-checkable criteria preserve uncertainty.
  if (unknownCriteria.length) {
    push(checks, "unknownCriteria", "unknown", `${unknownCriteria.length} unverified condition(s): ${unknownCriteria.slice(0, 3).join("; ")}`);
  }

  const hasNoMatch = checks.some((c) => c.result === "no_match");
  const hasUnknown = checks.some((c) => c.result === "unknown");
  const hasVerifiedCriterion = checks.some((c) => c.result === "match");
  // An extraction containing no machine-checkable restrictions does not prove
  // eligibility. Keep it unknown instead of promoting a vacuous pass to match.
  const status = hasNoMatch
    ? "no_match"
    : hasUnknown || !hasVerifiedCriterion
    ? "unknown"
    : "match";

  return { status, checks, unknownCriteria };
};
