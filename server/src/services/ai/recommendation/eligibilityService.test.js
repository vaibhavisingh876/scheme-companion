import test from "node:test";
import assert from "node:assert/strict";

process.env.GROQ_API_KEY ||= "test-key-for-mocked-completion";
const { callExtractBatch, upsertRules } = await import("./eligibilityService.js");
const { verifyEligibility } = await import("./verification.js");

test("Groq batch response validation accepts rules grounded in preserved raw text", async () => {
  const rawText = "Applicants aged 18 years or above.\n  Original spacing remains. ";
  let submitted;
  const { byIndex, usage } = await callExtractBatch(
    [{ id: "scheme-1", text: rawText }],
    async (content) => {
      submitted = JSON.parse(content);
      return {
        choices: [{ message: { content: JSON.stringify({
          results: [{
            index: 0,
            rules: {
              age: { min: 18, max: null },
              sourceEvidence: [{ field: "age", text: "aged 18 years or above" }],
            },
          }],
        }) } }],
        usage: { total_tokens: 20 },
      };
    }
  );

  assert.equal(submitted[0].eligibilityText, rawText);
  assert.equal(byIndex.get(0).age.min, 18);
  assert.equal(usage.total_tokens, 20);
});

test("validated Groq rules are mapped to persistent SchemeEligibility upsert data", async () => {
  let args;
  const fakeDb = { schemeEligibility: { upsert: async (value) => { args = value; } } };
  const extractedRules = { age: { min: 18, max: null } };
  await upsertRules("scheme-1", "hash-1", extractedRules, "success", 0, null, fakeDb);
  assert.equal(args.where.schemeId, "scheme-1");
  assert.equal(args.create.sourceHash, "hash-1");
  assert.equal(args.create.extractedRules, extractedRules);
  assert.equal(args.update.status, "success");
});

test("verification excludes clear mismatches and leaves missing profile facts unknown", () => {
  const mismatch = verifyEligibility({ age: { min: 18, max: 30 } }, { age: 40 });
  assert.equal(mismatch.status, "no_match");
  const incomplete = verifyEligibility({ age: { min: 18, max: 30 } }, { age: null });
  assert.equal(incomplete.status, "unknown");
  assert.equal(verifyEligibility(null, { age: 25 }).status, "unknown");
});
