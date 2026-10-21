// Reciprocal Rank Fusion (RRF).
// Combines multiple independently-ranked id lists into one, without needing to
// normalize incomparable scores (cosine similarity vs ts_rank_cd).
//   RRF(d) = sum over lists r of  1 / (k + rank_r(d))
// k = 60 is the standard smoothing constant from the original RRF paper.
export const RRF_K = 60;

/**
 * @param {Array<Array<{id:string}>>} rankedLists each list ordered best-first
 * @param {number} k smoothing constant
 * @returns {Array<{id:string, rrfScore:number, ranks:Record<number,number>}>}
 *          fused list, sorted by rrfScore descending
 */
export const reciprocalRankFusion = (rankedLists, k = RRF_K) => {
  const fused = new Map();

  rankedLists.forEach((list, listIndex) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, position) => {
      const id = item?.id;
      if (!id) return;
      const rank = position + 1; // 1-based rank
      const contribution = 1 / (k + rank);
      const entry = fused.get(id) || { id, rrfScore: 0, ranks: {} };
      entry.rrfScore += contribution;
      entry.ranks[listIndex] = rank;
      fused.set(id, entry);
    });
  });

  return [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore);
};
