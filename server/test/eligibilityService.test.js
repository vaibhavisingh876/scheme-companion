import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createEligibilityService } from "../src/services/ai/recommendation/eligibilityService.js";

const quietLogger = { warn() {}, log() {}, error() {} };

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Minimal in-memory stand-in for prisma.groqEligibilityRule. It implements only
 * the methods the eligibility service uses, including Prisma-style
 * `{ increment: n }` updates.
 */
const createFakeDb = () => {
  const rows = new Map();
  let failReads = false;
  let failWrites = false;

  const applyUpdate = (current, update) => {
    const next = { ...current };
    for (const [key, value] of Object.entries(update)) {
      if (value && typeof value === "object" && !Array.isArray(value) && "increment" in value) {
        next[key] = Number(current[key] || 0) + Number(value.increment);
      } else {
        next[key] = value;
      }
    }
    return next;
  };

  const groqEligibilityRule = {
    findMany: async ({ where }) => {
      if (failReads) throw new Error("read failure");
      const ids = where?.schemeId?.in || [];
      return ids.filter((id) => rows.has(id)).map((id) => clone(rows.get(id)));
    },
    upsert: async ({ where, create, update }) => {
      if (failWrites) throw new Error("write failure");
      const schemeId = where.schemeId;
      if (rows.has(schemeId)) {
        const next = applyUpdate(rows.get(schemeId), update);
        rows.set(schemeId, next);
        return clone(next);
      }
      const created = { id: `rule-${schemeId}`, attempts: 0, ...create };
      rows.set(schemeId, created);
      return clone(created);
    },
    update: async ({ where, data }) => {
      if (failWrites) throw new Error("write failure");
      const next = applyUpdate(rows.get(where.schemeId), data);
      rows.set(where.schemeId, next);
      return clone(next);
    },
  };

  return {
    db: { groqEligibilityRule },
    rows,
    failReads: (value) => {
      failReads = value;
    },
    failWrites: (value) => {
      failWrites = value;
    },
  };
};

const validRules = {
  gender: ["female"],
  sourceEvidence: [{ field: "gender", text: "only for women" }],
};

const createFakeLLM = ({ fail = false, mode = "immediate" } = {}) => {
  const calls = [];
  const requestRules = async (texts, options = {}) => {
    calls.push({ texts: [...texts], options });
    if (mode === "delayed") {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (options.signal?.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    if (fail) throw new Error("groq unavailable");
    const byIndex = new Map();
    texts.forEach((_, index) => byIndex.set(index, { ...validRules }));
    return { byIndex, usage: 10, calls: 1 };
  };
  return { requestRules, calls };
};

const buildService = (overrides = {}) => {
  const fake = createFakeDb();
  const llm = createFakeLLM(overrides.llm);
  const service = createEligibilityService({
    db: fake.db,
    requestRules: llm.requestRules,
    maxAttempts: 2,
    minCallIntervalMs: 0,
    onDemandMinIntervalMs: 0,
    onDemandLimit: 5,
    onDemandTimeoutMs: 200,
    onDemandEnabled: true,
    now: () => new Date("2026-01-01T00:00:00Z"),
    logger: quietLogger,
    ...overrides.service,
  });
  return { service, fake, llm };
};

const entry = (id, eligibility) => ({ id, eligibility });

test("scenario A: first extraction persists rules and is usable immediately", async () => {
  const { service, fake, llm } = buildService();

  const result = await service.ensureEligibilityRules([
    entry("scheme-1", "Only women may apply."),
  ]);

  assert.equal(llm.calls.length, 1);
  assert.equal(result.stats.onDemandExtracted, 1);
  assert.deepEqual(result.rules.get("scheme-1").gender, ["female"]);
  assert.equal(fake.rows.size, 1);
  assert.equal(fake.rows.get("scheme-1").status, "success");
  assert.equal(fake.rows.get("scheme-1").schemeId, "scheme-1");
  assert.match(fake.rows.get("scheme-1").sourceHash, /^[a-f0-9]{32}$/);
});

test("scenario B: repeated users reuse the stored rules without another Groq call", async () => {
  const { service, llm } = buildService();

  await service.ensureEligibilityRules([entry("scheme-1", "Only women may apply.")]);
  assert.equal(llm.calls.length, 1);

  const secondUser = await service.ensureEligibilityRules([
    entry("scheme-1", "Only   women may  apply."),
  ]);
  assert.equal(llm.calls.length, 1);
  assert.equal(secondUser.stats.reused, 1);
  assert.equal(secondUser.stats.onDemandRequested, 0);
  assert.deepEqual(secondUser.rules.get("scheme-1").gender, ["female"]);
});

test("scenario C: changed eligibility text is stale and re-extracted", async () => {
  const { service, fake, llm } = buildService();

  await service.ensureEligibilityRules([entry("scheme-1", "Only women may apply.")]);
  const oldHash = fake.rows.get("scheme-1").sourceHash;

  const result = await service.ensureEligibilityRules([
    entry("scheme-1", "Only married women may apply."),
  ]);

  assert.equal(llm.calls.length, 2);
  assert.equal(result.stats.reused, 0);
  assert.equal(result.stats.missing, 1);
  assert.notEqual(fake.rows.get("scheme-1").sourceHash, oldHash);
});

test("scenario D: unrelated changes keep the stored rules", async () => {
  const { service, llm } = buildService();

  await service.ensureEligibilityRules([entry("scheme-1", "Only women may apply.")]);
  const unchanged = await service.ensureEligibilityRules([
    entry("scheme-1", "Only women may apply."),
  ]);

  assert.equal(llm.calls.length, 1);
  assert.equal(unchanged.stats.reused, 1);
});

test("scenario F: failed extraction persists attempts and stops after maxAttempts", async () => {
  const { service, fake, llm } = buildService({ llm: { fail: true } });

  const first = await service.extractAndStore([entry("scheme-1", "Only women.")]);
  assert.equal(first.stats.failed, 1);
  assert.equal(fake.rows.get("scheme-1").status, "failed");
  assert.equal(fake.rows.get("scheme-1").attempts, 1);

  const second = await service.extractAndStore([entry("scheme-1", "Only women.")]);
  assert.equal(second.stats.failed, 1);
  assert.equal(fake.rows.get("scheme-1").attempts, 2);

  const callsBeforeRead = llm.calls.length;
  const stored = await service.getStoredEligibilityRules([
    entry("scheme-1", "Only women."),
  ]);
  assert.equal(stored.stats.exhausted, 1);
  assert.equal(stored.missing.length, 0);
  assert.equal(llm.calls.length, callsBeforeRead);
});

test("exhausted failures become retryable after the cooldown", async () => {
  let current = new Date("2026-01-01T00:00:00Z");
  const fake = createFakeDb();
  const llm = createFakeLLM({ fail: true });
  const service = createEligibilityService({
    db: fake.db,
    requestRules: llm.requestRules,
    maxAttempts: 1,
    retryCooldownMs: 60000,
    minCallIntervalMs: 0,
    logger: quietLogger,
    now: () => current,
  });

  await service.extractAndStore([entry("scheme-1", "Only women.")]);
  const exhausted = await service.getStoredEligibilityRules([entry("scheme-1", "Only women.")]);
  assert.equal(exhausted.stats.exhausted, 1);

  current = new Date("2026-01-01T00:02:00Z");
  const retryable = await service.getStoredEligibilityRules([entry("scheme-1", "Only women.")]);
  assert.equal(retryable.stats.exhausted, 0);
  assert.equal(retryable.stats.missing, 1);
});

test("invalid model output is recorded as a failed attempt", async () => {
  const fake = createFakeDb();
  const service = createEligibilityService({
    db: fake.db,
    requestRules: async () => ({ byIndex: new Map(), usage: 3, calls: 1 }),
    minCallIntervalMs: 0,
    logger: quietLogger,
  });

  const result = await service.extractAndStore([entry("scheme-1", "Only women.")]);
  assert.equal(result.stats.failed, 1);
  assert.equal(fake.rows.get("scheme-1").status, "failed");
  assert.match(fake.rows.get("scheme-1").lastError, /no valid rules/);
});

test("scenario G: concurrent extraction coalesces on the in-flight scheme", async () => {
  const { service, llm } = buildService({ llm: { mode: "delayed" } });

  const [a, b] = await Promise.all([
    service.extractAndStore([entry("scheme-1", "Only women.")]),
    service.extractAndStore([entry("scheme-1", "Only women.")]),
  ]);

  assert.equal(llm.calls.length, 1);
  assert.equal(a.stats.extracted + b.stats.extracted, 1);
  assert.equal(a.stats.skippedRunning + b.stats.skippedRunning, 1);
});

test("schema-level read failure degrades to unknown instead of throwing", async () => {
  const { service, fake } = buildService();
  fake.failReads(true);

  const result = await service.getStoredEligibilityRules([entry("scheme-1", "Only women.")]);
  assert.equal(result.stats.readFailed, true);
  assert.equal(result.stats.missing, 1);
  assert.equal(result.rules.get("scheme-1"), null);
});

test("write failure is counted and never reported as extracted", async () => {
  const { service, fake } = buildService();
  fake.failWrites(true);

  const result = await service.extractAndStore([entry("scheme-1", "Only women.")]);
  assert.equal(result.stats.extracted, 0);
  assert.equal(result.stats.failed, 1);
  assert.equal(result.stats.persistFailed, 1);
  assert.equal(result.rules.size, 0);
});

test("schemes without eligibility text are skipped, not sent to Groq", async () => {
  const { service, fake, llm } = buildService();

  const result = await service.ensureEligibilityRules([
    entry("scheme-1", "   "),
    entry("scheme-2", null),
  ]);

  assert.equal(llm.calls.length, 0);
  assert.equal(result.stats.noText, 2);
  assert.equal(fake.rows.size, 0);
});

test("on-demand can be disabled, leaving schemes unknown and queued", async () => {
  const { service, llm } = buildService({
    service: { onDemandEnabled: false },
  });

  const result = await service.ensureEligibilityRules([entry("scheme-1", "Only women.")]);
  assert.equal(result.stats.onDemandRequested, 0);
  assert.equal(result.stats.enqueued, 1);

  // The fire-and-forget queue drains on the next turns of the event loop.
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(llm.calls.length, 1);
});

test("on-demand timeout leaves the scheme unknown for the background queue", async () => {
  const fake = createFakeDb();
  const service = createEligibilityService({
    db: fake.db,
    requestRules: (texts, options) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => resolve({ byIndex: new Map([[0, validRules]]), usage: 1, calls: 1 }),
          100
        );
        options.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      }),
    minCallIntervalMs: 0,
    onDemandMinIntervalMs: 0,
    onDemandLimit: 1,
    onDemandTimeoutMs: 10,
    logger: quietLogger,
  });

  const result = await service.ensureEligibilityRules([entry("scheme-1", "Only women.")]);
  assert.equal(result.stats.onDemandFailed, 1);
  assert.equal(result.stats.onDemandExtracted, 0);
  assert.equal(result.stats.enqueued, 1);
});

test("GroqEligibilityRules declares a cascading FK to Scheme", async () => {
  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8"
  );
  const model = schema.slice(schema.indexOf("model GroqEligibilityRule"));
  assert.match(model, /schemeId\s+String\s+@unique/);
  assert.match(model, /references:\s*\[id\][^)]*onDelete:\s*Cascade/);
  const scheme = schema.slice(schema.indexOf("model Scheme "), schema.indexOf("model GroqEligibilityRule"));
  assert.match(scheme, /groqEligibility\s+GroqEligibilityRule\?/);
});
