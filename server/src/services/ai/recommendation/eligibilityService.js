import prisma from "../../../config/prisma.js";
import { normalizeText } from "../../../utils/helpers.js";
import { sourceHashOf } from "./eligibilityHash.js";
import {
  requestEligibilityRules,
  isAbortError,
  MODEL_VERSION,
} from "./eligibilityLLM.js";

const HARD_CAP = 60; // shortlist is at most 50 (rerank stage)
const BATCH_SIZE = 5;
const ROW_CHUNK = 500;
const MAX_ATTEMPTS = 2;

const envInt = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const DEFAULT_MIN_CALL_INTERVAL_MS = envInt("ELIGIBILITY_MIN_INTERVAL_MS", 20000);
const DEFAULT_ON_DEMAND_LIMIT = envInt("ELIGIBILITY_ON_DEMAND_BATCH", 5);
const DEFAULT_ON_DEMAND_TIMEOUT_MS = envInt("ELIGIBILITY_ON_DEMAND_TIMEOUT_MS", 8000);
const DEFAULT_ON_DEMAND_MIN_INTERVAL_MS = envInt("ELIGIBILITY_ON_DEMAND_MIN_INTERVAL_MS", 1000);
const DEFAULT_ON_DEMAND_ENABLED = process.env.ELIGIBILITY_ON_DEMAND !== "false";
const DEFAULT_RETRY_COOLDOWN_MS = envInt(
  "ELIGIBILITY_RETRY_COOLDOWN_MS",
  30 * 60 * 1000
);

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const normalizeEntry = (scheme) => {
  const schemeId = scheme?.schemeId || scheme?.id;
  if (!schemeId) return null;
  const rawText = scheme?.eligibility ?? scheme?.text ?? "";
  const text = normalizeText(rawText);
  return {
    schemeId,
    text,
    hash: scheme?.hash || sourceHashOf(rawText),
  };
};

const prepareEntries = (schemes) => {
  const seen = new Set();
  const prepared = [];
  for (const scheme of schemes || []) {
    const entry = normalizeEntry(scheme);
    if (!entry || seen.has(entry.schemeId)) continue;
    seen.add(entry.schemeId);
    prepared.push(entry);
  }
  return prepared;
};

/**
 * Creates an eligibility service with injectable storage + LLM dependencies.
 *
 * Production uses the default instance below. Tests construct isolated
 * instances with an in-memory db and a fake LLM so every state transition
 * (first extraction, reuse, staleness, failure, concurrency) is deterministic.
 */
export const createEligibilityService = ({
  db = prisma,
  requestRules = requestEligibilityRules,
  modelVersion = MODEL_VERSION,
  maxAttempts = MAX_ATTEMPTS,
  minCallIntervalMs = DEFAULT_MIN_CALL_INTERVAL_MS,
  onDemandEnabled = DEFAULT_ON_DEMAND_ENABLED,
  onDemandLimit = DEFAULT_ON_DEMAND_LIMIT,
  onDemandTimeoutMs = DEFAULT_ON_DEMAND_TIMEOUT_MS,
  onDemandMinIntervalMs = DEFAULT_ON_DEMAND_MIN_INTERVAL_MS,
  retryCooldownMs = DEFAULT_RETRY_COOLDOWN_MS,
  now = () => new Date(),
  logger = console,
} = {}) => {
  const pending = new Map(); // schemeId -> prepared entry
  const running = new Set(); // schemeId currently in an extraction call
  let processing = false;

  const readRows = async (schemeIds) => {
    const rows = [];
    for (const ids of chunk(schemeIds, ROW_CHUNK)) {
      const page = await db.groqEligibilityRule.findMany({
        where: { schemeId: { in: ids } },
      });
      rows.push(...page);
    }
    return new Map(rows.map((row) => [row.schemeId, row]));
  };

  const upsertRule = async (data) => {
    try {
      return await db.groqEligibilityRule.upsert(data);
    } catch (error) {
      // Two concurrent first-time writers can race past Prisma's upsert. The
      // unique schemeId constraint turns that into a harmless update.
      if (error?.code === "P2002" || /unique constraint/i.test(String(error?.message))) {
        return db.groqEligibilityRule.update({
          where: { schemeId: data.where.schemeId },
          data: data.update,
        });
      }
      throw error;
    }
  };

  const persistSuccess = async (entry, rules) => {
    const extractedAt = now();
    await upsertRule({
      where: { schemeId: entry.schemeId },
      create: {
        schemeId: entry.schemeId,
        sourceHash: entry.hash,
        eligibilityRules: rules,
        status: "success",
        modelVersion,
        attempts: 0,
        lastError: null,
        extractedAt,
      },
      update: {
        sourceHash: entry.hash,
        eligibilityRules: rules,
        status: "success",
        modelVersion,
        attempts: 0,
        lastError: null,
        extractedAt,
      },
    });
  };

  const persistFailure = async (entry, message) => {
    const lastError = String(message || "unknown extraction failure").slice(0, 300);
    const failedAt = now();
    await upsertRule({
      where: { schemeId: entry.schemeId },
      create: {
        schemeId: entry.schemeId,
        sourceHash: entry.hash,
        eligibilityRules: null,
        status: "failed",
        modelVersion,
        attempts: 1,
        lastError,
        extractedAt: null,
        updatedAt: failedAt,
      },
      update: {
        sourceHash: entry.hash,
        eligibilityRules: null,
        status: "failed",
        modelVersion,
        attempts: { increment: 1 },
        lastError,
        extractedAt: null,
        updatedAt: failedAt,
      },
    });
  };

  /**
   * Reads persisted rules only. Never calls the LLM.
   * A row is reusable only when it succeeded for the exact current text hash.
   */
  const getStoredEligibilityRules = async (schemes) => {
    const list = prepareEntries(schemes).slice(0, HARD_CAP);
    const stats = {
      requested: list.length,
      reused: 0,
      missing: 0,
      noText: 0,
      exhausted: 0,
      readFailed: false,
    };
    const rules = new Map();
    if (!list.length) return { rules, missing: [], stats };

    let bySchemeId;
    try {
      bySchemeId = await readRows(list.map((entry) => entry.schemeId));
    } catch (error) {
      stats.readFailed = true;
      logger.warn("[eligibility] rules read failed:", error.message);
      bySchemeId = new Map();
    }

    const missing = [];
    for (const entry of list) {
      if (!entry.text) {
        rules.set(entry.schemeId, null);
        stats.noText++;
        continue;
      }

      const row = bySchemeId.get(entry.schemeId);
      if (
        row &&
        row.status === "success" &&
        row.sourceHash === entry.hash &&
        row.eligibilityRules
      ) {
        rules.set(entry.schemeId, row.eligibilityRules);
        stats.reused++;
        continue;
      }

      if (
        row &&
        row.status === "failed" &&
        row.sourceHash === entry.hash &&
        row.attempts >= maxAttempts
      ) {
        // Stop hammering the provider, but do not lock a scheme out forever:
        // after the cooldown it gets another attempt (e.g. after an outage).
        const lastAttemptAt = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
        const cooledDown = now().getTime() - lastAttemptAt >= retryCooldownMs;
        if (!cooledDown || !Number.isFinite(lastAttemptAt) || lastAttemptAt === 0) {
          rules.set(entry.schemeId, null);
          stats.exhausted++;
          continue;
        }
      }

      rules.set(entry.schemeId, null);
      missing.push(entry);
      stats.missing++;
    }

    return { rules, missing, stats };
  };

  /**
   * Calls Groq for the supplied entries and persists validated rules.
   * Aborts are re-thrown without marking rows as failed, because an aborted
   * on-demand attempt is not evidence that extraction is impossible.
   */
  const extractAndStore = async (schemes, options = {}) => {
    const batchSize = Math.max(1, options.batchSize || BATCH_SIZE);
    const entries = prepareEntries(schemes);
    const list = entries
      .filter((entry) => entry.text && !running.has(entry.schemeId))
      .slice(0, HARD_CAP);

    const stats = {
      requested: list.length,
      extracted: 0,
      failed: 0,
      persistFailed: 0,
      llmCalls: 0,
      tokens: 0,
      skippedRunning: entries.length - list.length,
    };
    const extractedRules = new Map();

    for (const batch of chunk(list, batchSize)) {
      if (options.signal?.aborted) {
        const abortError =
          options.signal.reason instanceof Error
            ? options.signal.reason
            : Object.assign(new Error("eligibility extraction aborted"), {
                name: "AbortError",
              });
        throw abortError;
      }

      batch.forEach((entry) => running.add(entry.schemeId));
      try {
        let result;
        try {
          result = await requestRules(
            batch.map((entry) => entry.text),
            {
              signal: options.signal,
              minIntervalMs:
                options.minIntervalMs === undefined
                  ? minCallIntervalMs
                  : options.minIntervalMs,
              max429Retries: options.max429Retries,
              recoverMissing: options.recoverMissing,
              timeoutMs: options.timeoutMs,
            }
          );
        } catch (error) {
          if (isAbortError(error, options.signal)) throw error;
          const message = String(error?.message || error);
          logger.warn(`[eligibility] batch failed (${batch.length}):`, message);
          for (const entry of batch) {
            try {
              await persistFailure(entry, message);
            } catch (persistError) {
              stats.persistFailed++;
              logger.warn("[eligibility] failure-row persist error:", persistError.message);
            }
            stats.failed++;
          }
          continue;
        }

        stats.llmCalls += Number(result?.calls || 1);
        stats.tokens += Number(result?.usage || 0);

        for (let i = 0; i < batch.length; i++) {
          const entry = batch[i];
          const rules = result?.byIndex?.get(i);
          if (!rules) {
            try {
              await persistFailure(entry, "no valid rules in model output");
            } catch (error) {
              stats.persistFailed++;
              logger.warn("[eligibility] failure-row persist error:", error.message);
            }
            stats.failed++;
            continue;
          }

          try {
            await persistSuccess(entry, rules);
            extractedRules.set(entry.schemeId, rules);
            stats.extracted++;
          } catch (error) {
            stats.persistFailed++;
            stats.failed++;
            logger.warn(`[eligibility] could not persist rules for ${entry.schemeId}:`, error.message);
          }
        }
      } finally {
        batch.forEach((entry) => running.delete(entry.schemeId));
      }
    }

    return { rules: extractedRules, stats };
  };

  const processQueue = async () => {
    if (processing) return;
    processing = true;
    try {
      while (pending.size > 0) {
        const batch = [...pending.values()].slice(0, HARD_CAP);
        batch.forEach((entry) => pending.delete(entry.schemeId));
        const { stats } = await extractAndStore(batch, {
          minIntervalMs: minCallIntervalMs,
          max429Retries: 3,
          recoverMissing: true,
        });
        logger.log(
          `[eligibility:bg] extracted=${stats.extracted} failed=${stats.failed} llm=${stats.llmCalls} tokens=${stats.tokens} remaining=${pending.size}`
        );
      }
    } catch (error) {
      logger.warn("[eligibility:bg] processor error:", error.message);
    } finally {
      processing = false;
    }
  };

  const enqueueEligibilityExtraction = (schemes) => {
    let added = 0;
    for (const entry of prepareEntries(schemes)) {
      if (!entry.text || pending.has(entry.schemeId) || running.has(entry.schemeId)) {
        continue;
      }
      pending.set(entry.schemeId, entry);
      added++;
    }
    if (added > 0) {
      // Fire-and-forget keeps the request path fast.
      processQueue().catch((error) =>
        logger.warn("[eligibility:bg] kick error:", error.message)
      );
    }
    return added;
  };

  /**
   * Request-path entry point.
   *
   * 1. Reuse persisted rules whose source hash still matches.
   * 2. For the highest-ranked missing schemes, make ONE bounded synchronous
   *    extraction attempt so fresh rules are usable in this response.
   * 3. Enqueue everything still missing for paced background extraction.
   */
  const ensureEligibilityRules = async (schemes, options = {}) => {
    const stored = await getStoredEligibilityRules(schemes);
    const stats = {
      ...stored.stats,
      onDemandRequested: 0,
      onDemandExtracted: 0,
      onDemandFailed: 0,
      enqueued: 0,
      llmCalls: 0,
      tokens: 0,
    };

    if (!stored.missing.length) {
      return { rules: stored.rules, stats };
    }

    const shouldExtract = options.onDemand ?? onDemandEnabled;
    let candidates = [];
    if (shouldExtract && onDemandLimit > 0) {
      candidates = stored.missing
        .filter((entry) => !running.has(entry.schemeId) && !pending.has(entry.schemeId))
        .slice(0, onDemandLimit);
    }

    let succeeded = new Set();
    if (candidates.length) {
      stats.onDemandRequested = candidates.length;
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("eligibility extraction timed out")),
        onDemandTimeoutMs
      );
      timer.unref?.();

      try {
        const { rules, stats: extractionStats } = await extractAndStore(candidates, {
          signal: controller.signal,
          minIntervalMs: onDemandMinIntervalMs,
          max429Retries: 0,
          recoverMissing: false,
          batchSize: candidates.length,
        });
        for (const [schemeId, extracted] of rules) {
          stored.rules.set(schemeId, extracted);
        }
        succeeded = new Set(rules.keys());
        stats.onDemandExtracted = extractionStats.extracted;
        stats.onDemandFailed = extractionStats.failed;
        stats.llmCalls += extractionStats.llmCalls;
        stats.tokens += extractionStats.tokens;
      } catch (error) {
        stats.onDemandFailed += candidates.length;
        logger.warn("[eligibility] on-demand extraction skipped:", error.message);
      } finally {
        clearTimeout(timer);
      }
    }

    const remaining = stored.missing.filter((entry) => !succeeded.has(entry.schemeId));
    stats.enqueued = enqueueEligibilityExtraction(remaining);

    return { rules: stored.rules, stats };
  };

  return {
    getStoredEligibilityRules,
    extractAndStore,
    ensureEligibilityRules,
  };
};

const defaultService = createEligibilityService();

export const getStoredEligibilityRules = defaultService.getStoredEligibilityRules;
export const extractAndStore = defaultService.extractAndStore;
export const ensureEligibilityRules = defaultService.ensureEligibilityRules;
