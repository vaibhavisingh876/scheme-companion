import crypto from "crypto";
import Groq from "groq-sdk";
import prisma from "../../../config/prisma.js";
import { eligibilityRulesSchema, normalizeRules } from "../../../validators/eligibilityRulesValidator.js";

const MODEL = "openai/gpt-oss-120b";
const MODEL_VERSION = `groq:${MODEL}`;

const BATCH_SIZE = 5; // schemes per LLM call (design: small-batch extraction)
const MAX_ATTEMPTS = 2; // retry limit for failed extractions
const HARD_CAP = 40; // never extract for more than this many schemes per invocation

// The Groq org is limited to ~8000 tokens/min. Extraction is therefore kept OUT
// of the request path (see getCachedEligibilityRules) and run here serially with
// pacing + 429 backoff so it can never starve profile extraction or add latency.
// Default pace leaves headroom for request-path Groq calls; lower it via env
// only when warming offline with no live traffic.
const MIN_CALL_INTERVAL_MS = Number(process.env.ELIGIBILITY_MIN_INTERVAL_MS || 20000);
const MAX_429_RETRIES = 3;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalizeText = (text) => String(text || "").replace(/\s+/g, " ").trim();

export const sourceHashOf = (eligibilityText) =>
  crypto.createHash("sha256").update(normalizeText(eligibilityText)).digest("hex").slice(0, 32);

const SYSTEM_PROMPT = `You are a precise eligibility-rule extraction engine for Indian government schemes.
You receive schemes, each with an "index" and its raw "eligibilityText".
Extract ONLY criteria explicitly stated (or unambiguously implied) by the text. NEVER invent, assume, or fill defaults.
If a criterion is not mentioned, set that field to null (arrays: null).

Return ONLY JSON of the form:
{"results":[{"index":<int>,"rules":{...}}]}
with exactly one entry per input, using the same indices.

rules fields:
- age: {"min":number|null,"max":number|null} | null  (only if an explicit age limit is stated)
- gender: ["male"|"female"|"other"] | ["all"] | null   (null unless text specifies; never assume)
- minAnnualIncome: number|null   (INR per year; 1 lakh = 100000)
- maxAnnualIncome: number|null
- state: [state names lowercase] | null   (null if all-India or not stated)
- casteCategory: ["general"|"sc"|"st"|"obc"|"minority"] | null
- occupation: [e.g. "student","farmer","worker"] | null
- educationLevel: [e.g. "10th","12th","undergraduate","postgraduate"] | null
- maritalStatus: [e.g. "widowed","married","unmarried"] | null
- residency: [e.g. "rural","urban"] | null
- unknownCriteria: [short strings] for eligibility conditions that cannot be reduced to the fields above (e.g. "resident for at least 5 years", "must not have availed benefit earlier"). Empty array if none.
- sourceEvidence: [{"field","text"}] quoting the exact source phrase that supports each populated field.

Hard rules:
- Populate a field ONLY when the text supports it. Vague/empty text yields mostly nulls.
- Never emit age:{"min":0} or gender:["all"] unless the text truly states no such restriction.
- Keep sourceEvidence quotes short and verbatim.`;

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Groq call with token-budget-friendly pacing + 429 backoff.
let lastCallAt = 0;
const callGroq = async (userContent) => {
  for (let attempt = 0; ; attempt++) {
    const wait = MIN_CALL_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    try {
      const response = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      lastCallAt = Date.now();
      return response;
    } catch (err) {
      lastCallAt = Date.now();
      const is429 = err?.status === 429 || /rate_limit|429/i.test(String(err?.message));
      if (is429 && attempt < MAX_429_RETRIES) {
        const retryIn = /in (\d+(?:\.\d+)?)s/i.exec(String(err?.message));
        await sleep((retryIn ? Number(retryIn[1]) : 15) * 1000 + 1000);
        continue;
      }
      throw err;
    }
  }
};

const parseBatchResponse = (raw) => {
  const parsed = JSON.parse(raw);
  // Accept {results:[...]}, [{results:[...]}], or bare [{index,rules}, ...].
  if (Array.isArray(parsed)) {
    if (parsed.length && Array.isArray(parsed[0]?.results)) return parsed.flatMap((p) => p.results || []);
    if (parsed.length && parsed[0] && "index" in parsed[0]) return parsed;
    return [];
  }
  return Array.isArray(parsed?.results) ? parsed.results : [];
};

const callExtractBatch = async (batch) => {
  const userContent = JSON.stringify(batch.map((s, i) => ({ index: i, eligibilityText: s.text })));
  const response = await callGroq(userContent);
  const raw = response?.choices?.[0]?.message?.content || "{}";

  const byIndex = new Map();
  let entries;
  try {
    entries = parseBatchResponse(raw);
  } catch (e) {
    console.warn("[eligibility] unparseable model output:", raw.slice(0, 160));
    entries = [];
  }
  for (const entry of entries) {
    const idx = Number(entry?.index);
    if (!Number.isInteger(idx)) continue;
    const validated = eligibilityRulesSchema.safeParse(normalizeRules(entry?.rules));
    if (validated.success) byIndex.set(idx, validated.data);
    else console.warn(`[eligibility] rules rejected idx ${idx}:`, JSON.stringify(validated.error?.issues?.slice(0, 2)));
  }
  return { byIndex, usage: response?.usage || null };
};

const upsertRules = async (schemeId, hash, rules, status, errorDelta, lastError) => {
  await prisma.schemeEligibility.upsert({
    where: { schemeId },
    create: {
      schemeId,
      sourceHash: hash,
      extractedRules: rules ?? undefined,
      status,
      modelVersion: MODEL_VERSION,
      attempts: status === "failed" ? 1 : 0,
      lastError: lastError ?? null,
    },
    update: {
      sourceHash: hash,
      extractedRules: rules ?? undefined,
      status,
      modelVersion: MODEL_VERSION,
      attempts: { increment: errorDelta },
      lastError: lastError ?? null,
    },
  });
};

const withHash = (schemes) =>
  (schemes || []).map((s) => ({
    schemeId: s.id,
    text: normalizeText(s.eligibility),
    hash: sourceHashOf(s.eligibility),
  }));

/**
 * REQUEST-PATH reader: cached rules only, NO LLM calls.
 * Returns reusable rules for schemes whose cached extraction is a success and
 * whose sourceHash still matches, plus the list of schemes that are missing or
 * stale (callers enqueue those for background extraction).
 *
 * @param {Array<{id:string, eligibility?:string}>} schemes
 * @returns {Promise<{rules:Map<string,object|null>, missing:Array, stats:object}>}
 */
export const getCachedEligibilityRules = async (schemes) => {
  const rules = new Map();
  const stats = { requested: 0, cacheHits: 0, missing: 0, exhausted: 0, noText: 0 };
  const list = (schemes || []).slice(0, HARD_CAP);
  stats.requested = list.length;
  if (!list.length) return { rules, missing: [], stats };

  const withH = withHash(list);
  const ids = withH.map((s) => s.schemeId);

  let existing = [];
  try {
    existing = await prisma.schemeEligibility.findMany({ where: { schemeId: { in: ids } } });
  } catch (err) {
    console.warn("[eligibility] cache read failed:", err.message);
  }
  const bySchemeId = new Map(existing.map((row) => [row.schemeId, row]));

  const missing = [];
  for (const s of withH) {
    if (!s.text) {
      rules.set(s.schemeId, null);
      stats.noText++;
      continue;
    }
    const row = bySchemeId.get(s.schemeId);
    if (row) {
      const hashMatches = row.sourceHash === s.hash;
      if (row.status === "success" && hashMatches && row.extractedRules) {
        rules.set(s.schemeId, row.extractedRules);
        stats.cacheHits++;
        continue;
      }
      if (row.status === "failed" && hashMatches && row.attempts >= MAX_ATTEMPTS) {
        rules.set(s.schemeId, null);
        stats.exhausted++;
        continue; // poison row: stop triggering extraction
      }
    }
    rules.set(s.schemeId, null);
    missing.push(s);
    stats.missing++;
  }

  return { rules, missing, stats };
};

/**
 * Extract + store rules for the given schemes (LLM). Runs SERIALLY with pacing
 * and 429 backoff so it stays within the token budget. Used by the background
 * queue and the offline warm script — never awaited in the request path.
 *
 * @param {Array<{id?:string, schemeId?:string, eligibility?:string, text?:string, hash?:string}>} schemes
 */
export const extractAndStore = async (schemes) => {
  const stats = { extracted: 0, failed: 0, llmCalls: 0, tokens: 0 };
  const normalized = (schemes || []).slice(0, HARD_CAP).map((s) => ({
    schemeId: s.schemeId || s.id,
    text: s.text ?? normalizeText(s.eligibility),
    hash: s.hash || sourceHashOf(s.eligibility),
  })).filter((s) => s.schemeId && s.text);

  for (const batch of chunk(normalized, BATCH_SIZE)) {
    stats.llmCalls++;
    try {
      const { byIndex, usage } = await callExtractBatch(batch);
      if (usage?.total_tokens) stats.tokens += usage.total_tokens;

      // Recover indices the model omitted with a single-scheme call.
      for (let i = 0; i < batch.length; i++) {
        if (byIndex.has(i)) continue;
        try {
          stats.llmCalls++;
          const single = await callExtractBatch([batch[i]]);
          if (single.usage?.total_tokens) stats.tokens += single.usage.total_tokens;
          const recovered = single.byIndex.get(0);
          if (recovered) byIndex.set(i, recovered);
        } catch {
          /* leave as failed below */
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const s = batch[i];
        const extracted = byIndex.get(i);
        if (extracted) {
          await upsertRules(s.schemeId, s.hash, extracted, "success", 0, null);
          stats.extracted++;
        } else {
          await upsertRules(s.schemeId, s.hash, null, "failed", 1, "no valid rules in model output");
          stats.failed++;
        }
      }
    } catch (err) {
      const msg = String(err?.message || err).slice(0, 300);
      console.warn(`[eligibility] batch failed (${batch.length}):`, msg);
      for (const s of batch) {
        try {
          await upsertRules(s.schemeId, s.hash, null, "failed", 1, msg);
        } catch (e2) {
          console.warn("[eligibility] failed-row upsert error:", e2.message);
        }
        stats.failed++;
      }
    }
  }
  return stats;
};

// ── Background extraction queue ─────────────────────────────────────────
// Fire-and-forget: dedupes pending schemes and processes them serially so the
// eligibility cache warms over time without ever blocking or rate-limiting a
// user request.
const pending = new Map(); // schemeId -> {schemeId, text, hash}
let processing = false;

const processQueue = async () => {
  if (processing) return;
  processing = true;
  try {
    while (pending.size > 0) {
      const batchSchemes = [...pending.values()].slice(0, HARD_CAP);
      batchSchemes.forEach((s) => pending.delete(s.schemeId));
      const stats = await extractAndStore(batchSchemes);
      console.log(
        `[eligibility:bg] extracted=${stats.extracted} failed=${stats.failed} llm=${stats.llmCalls} tokens=${stats.tokens} remaining=${pending.size}`
      );
    }
  } catch (err) {
    console.warn("[eligibility:bg] processor error:", err.message);
  } finally {
    processing = false;
  }
};

/**
 * Enqueue schemes for background eligibility extraction (non-blocking).
 * Only missing/stale schemes should be passed (see getCachedEligibilityRules).
 */
export const enqueueEligibilityExtraction = (schemes) => {
  let added = 0;
  for (const s of schemes || []) {
    const schemeId = s.schemeId || s.id;
    if (!schemeId || pending.has(schemeId)) continue;
    const text = s.text ?? normalizeText(s.eligibility);
    if (!text) continue;
    pending.set(schemeId, { schemeId, text, hash: s.hash || sourceHashOf(s.eligibility) });
    added++;
  }
  if (added > 0) {
    // Do not await — keeps the request path fast.
    processQueue().catch((e) => console.warn("[eligibility:bg] kick error:", e.message));
  }
  return added;
};

export const eligibilityQueueSize = () => pending.size;
