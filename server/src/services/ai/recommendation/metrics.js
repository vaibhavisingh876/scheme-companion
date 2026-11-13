// Per-request monitoring collector (Milestone 6).
// Tracks the signals the design calls for: latency per stage, candidate counts
// before/after each stage, LLM calls, tokens, and eligibility-rule reuse.

export const createMetrics = () => {
  const stages = {};
  const counters = {
    llmCalls: 0,
    tokens: 0,
    reused: 0,
    missing: 0,
    extracted: 0,
    onDemandExtracted: 0,
    onDemandFailed: 0,
    enqueued: 0,
    failed: 0,
  };
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
      counters.reused += stats.reused || 0;
      counters.missing += stats.missing || 0;
      counters.extracted += stats.extracted || 0;
      counters.onDemandExtracted += stats.onDemandExtracted || 0;
      counters.onDemandFailed += stats.onDemandFailed || 0;
      counters.enqueued += stats.enqueued || 0;
      counters.failed += stats.failed || 0;
      counters.llmCalls += stats.llmCalls || 0;
      counters.tokens += stats.tokens || 0;
    },
    summary() {
      const totalMs = Date.now() - startedAt;
      const requested = counters.reused + counters.missing;
      const reuseRate = requested ? Number((counters.reused / requested).toFixed(3)) : null;
      return {
        totalMs,
        stageMs: { ...stages },
        counts: { ...counts },
        llmCalls: counters.llmCalls,
        tokens: counters.tokens,
        eligibilityReuseRate: reuseRate,
        eligibility: {
          reused: counters.reused,
          missing: counters.missing,
          extracted: counters.extracted,
          onDemandExtracted: counters.onDemandExtracted,
          onDemandFailed: counters.onDemandFailed,
          enqueued: counters.enqueued,
          failed: counters.failed,
        },
      };
    },
  };
};

export const logMetrics = (label, summary) => {
  console.log(
    `[metrics:${label}] total=${summary.totalMs}ms stages=${JSON.stringify(summary.stageMs)} counts=${JSON.stringify(summary.counts)} llm=${summary.llmCalls} tokens=${summary.tokens} eligibilityReuseRate=${summary.eligibilityReuseRate}`
  );
};
