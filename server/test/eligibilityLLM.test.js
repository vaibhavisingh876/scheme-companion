import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBatchResponse,
  parseRulesResponse,
  createEligibilityLLM,
  isAbortError,
} from "../src/services/ai/recommendation/eligibilityLLM.js";

const quietLogger = { warn() {}, log() {}, error() {} };

const rules = {
  gender: ["female"],
  sourceEvidence: [{ field: "gender", text: "only for women" }],
};

const response = (payload) => ({
  choices: [{ message: { content: JSON.stringify(payload) } }],
  usage: { total_tokens: 7 },
});

const fakeClient = (handler) => ({
  chat: {
    completions: {
      create: (body, options) => Promise.resolve(handler(body, options)),
    },
  },
});

test("parseBatchResponse accepts the documented response shapes", () => {
  const entries = [{ index: 0, rules }];
  assert.deepEqual(parseBatchResponse(JSON.stringify({ results: entries })), entries);
  assert.deepEqual(parseBatchResponse(JSON.stringify([{ results: entries }])), entries);
  assert.deepEqual(parseBatchResponse(JSON.stringify(entries)), entries);
  assert.deepEqual(parseBatchResponse(JSON.stringify({ nope: true })), []);
});

test("parseRulesResponse drops invalid JSON instead of throwing", () => {
  const byIndex = parseRulesResponse("not json at all", quietLogger);
  assert.equal(byIndex.size, 0);
});

test("parseRulesResponse validates each rule set and keeps good indices", () => {
  const byIndex = parseRulesResponse(
    JSON.stringify({
      results: [
        { index: 0, rules },
        { index: 1, rules: { gender: ["female"] } }, // missing source evidence
        { index: "x", rules },
      ],
    }),
    quietLogger
  );
  assert.equal(byIndex.size, 1);
  assert.deepEqual(byIndex.get(0).gender, ["female"]);
});

test("requestRules returns validated rules plus usage/call counts", async () => {
  const client = fakeClient(() => response({ results: [{ index: 0, rules }] }));
  const llm = createEligibilityLLM({
    client,
    model: "test-model",
    minCallIntervalMs: 0,
    logger: quietLogger,
  });

  const result = await llm.requestRules(["Only women may apply."], {
    recoverMissing: false,
  });

  assert.equal(result.calls, 1);
  assert.equal(result.usage, 7);
  assert.deepEqual(result.byIndex.get(0).gender, ["female"]);
  assert.equal(llm.modelVersion, "groq:test-model");
});

test("missing indices are recovered with a single-scheme call unless disabled", async () => {
  let batchCalls = 0;
  const client = fakeClient((body) => {
    const payload = JSON.parse(body.messages[1].content);
    if (payload.length === 2) {
      batchCalls++;
      return response({ results: [{ index: 0, rules }] });
    }
    return response({ results: [{ index: 0, rules }] });
  });
  const llm = createEligibilityLLM({
    client,
    minCallIntervalMs: 0,
    logger: quietLogger,
  });

  const recovered = await llm.requestRules(["a", "b"]);
  assert.equal(batchCalls, 1);
  assert.equal(recovered.calls, 2);
  assert.equal(recovered.byIndex.size, 2);

  const noRecovery = await llm.requestRules(["a", "b"], { recoverMissing: false });
  assert.equal(noRecovery.calls, 1);
  assert.equal(noRecovery.byIndex.size, 1);
});

test("429 errors are retried, then surfaced", async () => {
  let attempts = 0;
  const client = fakeClient(() => {
    attempts++;
    const error = new Error("rate limit exceeded, retry in 0.01s");
    error.status = 429;
    throw error;
  });
  const llm = createEligibilityLLM({
    client,
    minCallIntervalMs: 0,
    logger: quietLogger,
  });

  await assert.rejects(
    () => llm.requestRules(["a"], { recoverMissing: false, max429Retries: 1 }),
    /rate limit exceeded/
  );
  assert.equal(attempts, 2);
});

test("isAbortError recognises aborted signals and abort error names", () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(isAbortError(new Error("x"), controller.signal), true);
  assert.equal(isAbortError({ name: "AbortError" }), true);
  assert.equal(isAbortError({ name: "TimeoutError" }), true);
  assert.equal(isAbortError(new Error("boom")), false);
});
