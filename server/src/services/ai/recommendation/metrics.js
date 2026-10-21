// Per-request monitoring collector (Milestone 6).
// Tracks the signals the design calls for: latency per stage, candidate counts
// before/after each stage, LLM calls, tokens, and eligibility cache hit rate.

export const createMetrics = () => {
  const stages = {};
  const counters = { llmCalls: 0, tokens: 0, cacheHits: 0, cacheMisses: 0, extracted: 0, failed: 0, skipped: 0 };
  const counts = {};
  const startedAt = Date.now();

  return {
    async time(stage, fn) {
      const t0 = Date.now();
      const result = await fn();
      stages[stage] = Date.now() - t0;
      return result;
    },
    setStage(stage, ms) {
      stages[stage] = ms;
    },
    count(name, value) {
      counts[name] = value;
    },
    addLlm(n = 1) {
      counters.llmCalls += n;
    },
    addTokens(n = 0) {
      counters.tokens += n;
    },
    addEligibilityStats(stats = {}) {
      counters.cacheHits += stats.cacheHits || 0;
      counters.cacheMisses += stats.missing || 0;
      counters.extracted += stats.extracted || 0;
      counters.failed += stats.failed || 0;
      counters.skipped += stats.skipped || 0;
      counters.llmCalls += stats.llmCalls || 0;
      counters.tokens += stats.tokens || 0;
    },
    summary() {
      const totalMs = Date.now() - startedAt;
      const eligRequests = counters.cacheHits + counters.cacheMisses;
      const cacheHitRate = eligRequests ? Number((counters.cacheHits / eligRequests).toFixed(3)) : null;
      return {
        totalMs,
        stageMs: { ...stages },
        counts: { ...counts },
        llmCalls: counters.llmCalls,
        tokens: counters.tokens,
        eligibilityCacheHitRate: cacheHitRate,
        eligibility: {
          cacheHits: counters.cacheHits,
          cacheMisses: counters.cacheMisses,
          extracted: counters.extracted,
          failed: counters.failed,
          skipped: counters.skipped,
        },
      };
    },
  };
};

export const logMetrics = (label, summary) => {
  console.log(
    `[metrics:${label}] total=${summary.totalMs}ms stages=${JSON.stringify(summary.stageMs)} counts=${JSON.stringify(summary.counts)} llm=${summary.llmCalls} tokens=${summary.tokens} cacheHitRate=${summary.eligibilityCacheHitRate}`
  );
};
