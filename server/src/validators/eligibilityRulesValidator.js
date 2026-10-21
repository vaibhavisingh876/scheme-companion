import { z } from "zod";

// Structured eligibility rules extracted from a scheme's raw eligibility text.
// Every field is optional/nullable: the extractor must populate ONLY what the
// source text supports. A null/absent field means "no such criterion stated",
// which verification treats as non-restrictive (never as a satisfied match).

const nullableInt = (min, max) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    },
    z.number().int().min(min).max(max).nullable()
  );

const stringArray = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v ? [v] : null;
    if (Array.isArray(v)) {
      const cleaned = v
        .map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""))
        .filter(Boolean);
      return cleaned.length ? cleaned : null;
    }
    return null;
  },
  z.array(z.string()).nullable()
);

const ageRange = z.preprocess(
  (v) => (v && typeof v === "object" ? v : null),
  z
    .object({
      min: nullableInt(0, 120),
      max: nullableInt(0, 120),
    })
    .nullable()
);

export const eligibilityRulesSchema = z.object({
  age: ageRange,
  gender: stringArray, // e.g. ["female"] ; ["all"] or null = unrestricted
  minAnnualIncome: nullableInt(0, 1e10),
  maxAnnualIncome: nullableInt(0, 1e10),
  state: stringArray,
  casteCategory: stringArray, // general | sc | st | obc | minority
  occupation: stringArray,
  educationLevel: stringArray,
  maritalStatus: stringArray, // e.g. ["widowed"]
  residency: stringArray, // e.g. ["rural"], ["urban"]
  // Criteria mentioned in the text that are not machine-checkable against the
  // user profile (e.g. "must not have availed benefit earlier"). Preserved so
  // verification can flag residual uncertainty instead of silently passing.
  unknownCriteria: z.preprocess(
    (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []),
    z.array(z.string()).default([])
  ),
  // Source-grounded evidence per populated field — supports explainability and
  // guards against hallucinated rules.
  sourceEvidence: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z
      .array(
        z.object({
          field: z.string().catch("unknown"),
          text: z.string().catch(""),
        })
      )
      .default([])
  ),
}).superRefine((rules, ctx) => {
  const evidenceFields = new Set(
    rules.sourceEvidence
      .map((item) => String(item.field || "").replace(/[^a-z]/gi, "").toLowerCase())
      .filter(Boolean)
  );
  const populated = [
    ["age", ["agemin", "agemax"], rules.age && (rules.age.min != null || rules.age.max != null)],
    ["gender", ["genders", "sex"], Array.isArray(rules.gender) && rules.gender.length > 0],
    ["minAnnualIncome", ["minincome", "minfamilyincome", "minannualincome", "income"], rules.minAnnualIncome != null],
    ["maxAnnualIncome", ["maxincome", "maxfamilyincome", "incomeceiling", "maxannualincome", "income"], rules.maxAnnualIncome != null],
    ["state", ["states", "region", "applicablestates"], Array.isArray(rules.state) && rules.state.length > 0],
    ["casteCategory", ["caste", "category", "categories", "socialcategory"], Array.isArray(rules.casteCategory) && rules.casteCategory.length > 0],
    ["occupation", ["occupations", "targetoccupation"], Array.isArray(rules.occupation) && rules.occupation.length > 0],
    ["educationLevel", ["education", "educationlevels"], Array.isArray(rules.educationLevel) && rules.educationLevel.length > 0],
    ["maritalStatus", ["marital"], Array.isArray(rules.maritalStatus) && rules.maritalStatus.length > 0],
    ["residency", ["residence", "area", "residentialtype"], Array.isArray(rules.residency) && rules.residency.length > 0],
    ["unknownCriteria", ["othercriteria"], rules.unknownCriteria.length > 0],
  ];
  for (const [field, aliases, hasValue] of populated) {
    const acceptedFields = [field, ...aliases].map((name) => name.replace(/[^a-z]/gi, "").toLowerCase());
    if (hasValue && !acceptedFields.some((name) => evidenceFields.has(name))) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceEvidence"],
        message: `source evidence is required for populated field: ${field}`,
      });
    }
  }
});

// Batch response from the extractor: results aligned to inputs by index.
export const eligibilityBatchSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int(),
      rules: eligibilityRulesSchema,
    })
  ),
});

// ── Normalization ───────────────────────────────────────────────────────
// LLMs frequently emit near-miss field names (age_min, max_family_income,
// gender as a bare string). Coerce those variants into the canonical shape
// BEFORE validation so a good extraction is not discarded over naming drift.

const toIncomeNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).toLowerCase().replace(/[,₹\s]/g, "");
  const lakh = /(\d+(?:\.\d+)?)\s*(lakh|lac|l)/.exec(String(v).toLowerCase());
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null);

export const normalizeRules = (raw) => {
  if (!raw || typeof raw !== "object") return {};
  const r = raw;

  const ageMin = firstDefined(r.age?.min, r.age_min, r.min_age, r.minAge, r.ageMin);
  const ageMax = firstDefined(r.age?.max, r.age_max, r.max_age, r.maxAge, r.ageMax);
  const age =
    r.age && typeof r.age === "object"
      ? { min: ageMin ?? null, max: ageMax ?? null }
      : ageMin != null || ageMax != null
      ? { min: ageMin ?? null, max: ageMax ?? null }
      : null;

  return {
    age,
    gender: firstDefined(r.gender, r.genders, r.sex),
    minAnnualIncome: toIncomeNumber(firstDefined(r.minAnnualIncome, r.min_annual_income, r.min_income, r.minIncome, r.min_family_income)),
    maxAnnualIncome: toIncomeNumber(firstDefined(r.maxAnnualIncome, r.max_annual_income, r.max_income, r.maxIncome, r.max_family_income, r.income_ceiling)),
    state: firstDefined(r.state, r.states, r.region, r.applicableStates),
    casteCategory: firstDefined(r.casteCategory, r.caste_category, r.caste, r.category, r.categories, r.socialCategory),
    occupation: firstDefined(r.occupation, r.occupations, r.targetOccupation),
    educationLevel: firstDefined(r.educationLevel, r.education_level, r.education),
    maritalStatus: firstDefined(r.maritalStatus, r.marital_status, r.marital),
    residency: firstDefined(r.residency, r.residence, r.area, r.residentialType),
    unknownCriteria: firstDefined(r.unknownCriteria, r.unknown_criteria, r.otherCriteria, []),
    sourceEvidence: firstDefined(r.sourceEvidence, r.source_evidence, r.evidence, []),
  };
};
