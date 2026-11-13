// Final ranking stays deliberately simple: eligibility status first, then the
// cross-encoder relevance score. No composite formula, no second semantic pass.
// Within a status group the cross-encoder order is authoritative; if the
// reranker is unavailable we fall back to the RRF retrieval order.

const STATUS_RANK = {
  match: 0,
  unknown: 1,
  no_match: 2,
};

export const rankEligibilityResults = (schemes, { limit = 20 } = {}) => {
  const eligible = (schemes || []).filter(
    (scheme) => scheme?._eligibilityStatus !== "no_match"
  );

  const ordered = [...eligible].sort((a, b) => {
    const statusDifference =
      (STATUS_RANK[a._eligibilityStatus] ?? 1) - (STATUS_RANK[b._eligibilityStatus] ?? 1);
    if (statusDifference !== 0) return statusDifference;

    const aScore = Number.isFinite(a.crossEncoderScore) ? a.crossEncoderScore : null;
    const bScore = Number.isFinite(b.crossEncoderScore) ? b.crossEncoderScore : null;
    if (aScore !== null && bScore !== null) return bScore - aScore;

    return (a._retrievalRank ?? 0) - (b._retrievalRank ?? 0);
  });

  return ordered.slice(0, Math.max(0, limit));
};

export const sigmoid = (value) => 1 / (1 + Math.exp(-value));

/**
 * Display-only score for the existing UI. Cross-encoder logits are unbounded,
 * so they are mapped through a sigmoid; when the reranker is unavailable the
 * fused RRF score is normalised against the pool maximum.
 */
export const publicRelevanceScore = (scheme, maxRrf = 0) => {
  if (Number.isFinite(scheme?.crossEncoderScore)) {
    return Math.round(sigmoid(scheme.crossEncoderScore) * 100);
  }
  if (maxRrf > 0 && Number.isFinite(scheme?._rrfScore)) {
    return Math.max(1, Math.round((scheme._rrfScore / maxRrf) * 100));
  }
  return 0;
};
