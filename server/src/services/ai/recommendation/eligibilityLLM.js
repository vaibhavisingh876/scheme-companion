import Groq from "groq-sdk";
import {
  eligibilityRulesSchema,
  normalizeRules,
} from "../../../validators/eligibilityRulesValidator.js";

const DEFAULT_MODEL = process.env.GROQ_ELIGIBILITY_MODEL || "openai/gpt-oss-120b";
const DEFAULT_MIN_INTERVAL_MS = Number(process.env.ELIGIBILITY_MIN_INTERVAL_MS || 20000);
const MAX_429_RETRIES = 3;

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

let defaultClient = null;

// Lazy so importing this module (e.g. in tests or ingestion scripts) never
// requires a live Groq key.
const getDefaultClient = () => {
  if (!defaultClient) {
    defaultClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: process.env.GROQ_BASE_URL || undefined,
    });
  }
  return defaultClient;
};

const toAbortError = (signal) => {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error("eligibility extraction aborted");
  error.name = "AbortError";
  return error;
};

export const isAbortError = (error, signal) =>
  Boolean(signal?.aborted) ||
  error?.name === "AbortError" ||
  error?.name === "APIUserAbortError" ||
  error?.name === "TimeoutError";

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw toAbortError(signal);
};

const abortableSleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(toAbortError(signal));
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });

const raceWithAbort = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(toAbortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(toAbortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
};

const createSerialQueue = () => {
  let tail = Promise.resolve();
  return (task) => {
    const run = tail.then(task, task);
    tail = run.then(
      () => {},
      () => {}
    );
    return run;
  };
};

export const parseBatchResponse = (raw) => {
  const parsed = JSON.parse(raw);
  // Accept {results:[...]}, [{results:[...]}], or bare [{index,rules}, ...].
  if (Array.isArray(parsed)) {
    if (parsed.length && Array.isArray(parsed[0]?.results)) {
      return parsed.flatMap((part) => part.results || []);
    }
    if (parsed.length && parsed[0] && "index" in parsed[0]) return parsed;
    return [];
  }
  return Array.isArray(parsed?.results) ? parsed.results : [];
};

/**
 * Parses and validates a raw model response. Invalid JSON or invalid rule
 * objects are dropped rather than persisted; callers treat missing indices as
 * extraction failures.
 */
export const parseRulesResponse = (raw, logger = console) => {
  const byIndex = new Map();
  let entries;
  try {
    entries = parseBatchResponse(raw);
  } catch {
    logger.warn("[eligibility] unparseable model output:", String(raw).slice(0, 160));
    return byIndex;
  }

  for (const entry of entries) {
    const idx = Number(entry?.index);
    if (!Number.isInteger(idx)) continue;
    const validated = eligibilityRulesSchema.safeParse(normalizeRules(entry?.rules));
    if (validated.success) {
      byIndex.set(idx, validated.data);
    } else {
      logger.warn(
        `[eligibility] rules rejected idx ${idx}:`,
        JSON.stringify(validated.error?.issues?.slice(0, 2))
      );
    }
  }
  return byIndex;
};

const isRateLimit = (error) =>
  error?.status === 429 || /rate_limit|429/i.test(String(error?.message));

/**
 * Creates an isolated extraction client. Tests can pass a fake `client` with
 * the same `chat.completions.create` shape and measure call counts.
 */
export const createEligibilityLLM = ({
  client,
  model = DEFAULT_MODEL,
  minCallIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  logger = console,
} = {}) => {
  const queue = createSerialQueue();
  let lastCallAt = 0;

  const callModel = (body, options = {}) => {
    const {
      signal,
      minIntervalMs = minCallIntervalMs,
      max429Retries = MAX_429_RETRIES,
      timeoutMs,
    } = options;

    const task = async () => {
      throwIfAborted(signal);
      const wait = minIntervalMs - (Date.now() - lastCallAt);
      if (wait > 0) await abortableSleep(wait, signal);
      throwIfAborted(signal);

      for (let attempt = 0; ; attempt++) {
        try {
          const response = await (client || getDefaultClient()).chat.completions.create(
            body,
            {
              signal,
              maxRetries: 0,
              ...(timeoutMs ? { timeout: timeoutMs } : {}),
            }
          );
          lastCallAt = Date.now();
          return response;
        } catch (error) {
          lastCallAt = Date.now();
          if (isAbortError(error, signal)) throw toAbortError(signal);
          if (isRateLimit(error) && attempt < max429Retries) {
            const retryIn = /in (\d+(?:\.\d+)?)s/i.exec(String(error?.message));
            const delayMs = (retryIn ? Number(retryIn[1]) : 15) * 1000 + 1000;
            logger.warn(
              `[eligibility] rate limited; retrying in ${delayMs}ms (${attempt + 1}/${max429Retries})`
            );
            await abortableSleep(delayMs, signal);
            continue;
          }
          throw error;
        }
      }
    };

    return raceWithAbort(queue(task), signal);
  };

  const requestRules = async (texts, options = {}) => {
    const body = {
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(
            (texts || []).map((text, index) => ({ index, eligibilityText: text }))
          ),
        },
      ],
    };

    const response = await callModel(body, options);
    const raw = response?.choices?.[0]?.message?.content || "{}";
    const byIndex = parseRulesResponse(raw, logger);
    let usage = Number(response?.usage?.total_tokens || 0);
    let calls = 1;

    // Recover indices the model omitted with a single-scheme call. On-demand
    // extraction disables this to stay inside its request budget.
    if (options.recoverMissing !== false) {
      for (let i = 0; i < (texts || []).length; i++) {
        if (byIndex.has(i)) continue;
        try {
          const single = await requestRules([texts[i]], {
            ...options,
            recoverMissing: false,
          });
          const recovered = single.byIndex.get(0);
          if (recovered) byIndex.set(i, recovered);
          usage += single.usage;
          calls += single.calls;
        } catch (error) {
          if (isAbortError(error, options.signal)) throw error;
          // Leave the index unresolved; the caller records a failed attempt.
        }
      }
    }

    return { byIndex, usage, calls };
  };

  return { requestRules, modelVersion: `groq:${model}`, model };
};

const defaultLLM = createEligibilityLLM();

export const requestEligibilityRules = (...args) => defaultLLM.requestRules(...args);
export const MODEL_VERSION = defaultLLM.modelVersion;
