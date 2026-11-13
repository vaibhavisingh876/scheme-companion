import test from "node:test";
import assert from "node:assert/strict";
import {
  rankEligibilityResults,
  publicRelevanceScore,
  sigmoid,
} from "../src/services/ai/recommendation/ranking.js";

const scheme = (id, status, score, retrievalRank = 0) => ({
  id,
  _eligibilityStatus: status,
  crossEncoderScore: score,
  _retrievalRank: retrievalRank,
});

test("confirmed no_match schemes are excluded", () => {
  const ranked = rankEligibilityResults([
    scheme("a", "no_match", 10),
    scheme("b", "match", 1),
  ]);
  assert.deepEqual(ranked.map((s) => s.id), ["b"]);
});

test("match ranks above unknown regardless of cross-encoder score", () => {
  const ranked = rankEligibilityResults([
    scheme("unknown-high", "unknown", 9),
    scheme("match-low", "match", -3),
  ]);
  assert.deepEqual(ranked.map((s) => s.id), ["match-low", "unknown-high"]);
});

test("within a status group, cross-encoder score decides", () => {
  const ranked = rankEligibilityResults([
    scheme("low", "match", -2),
    scheme("high", "match", 5),
    scheme("mid", "match", 1),
  ]);
  assert.deepEqual(ranked.map((s) => s.id), ["high", "mid", "low"]);
});

test("missing cross-encoder scores fall back to retrieval order", () => {
  const ranked = rankEligibilityResults([
    scheme("third", "match", null, 3),
    scheme("first", "match", null, 1),
    scheme("second", "match", null, 2),
  ]);
  assert.deepEqual(ranked.map((s) => s.id), ["first", "second", "third"]);
});

test("results are capped at the limit (default 20, or fewer candidates)", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    scheme(`s${i}`, "match", 30 - i)
  );
  assert.equal(rankEligibilityResults(many).length, 20);
  assert.equal(rankEligibilityResults(many, { limit: 7 }).length, 7);
  assert.equal(rankEligibilityResults([scheme("only", "unknown", 0)]).length, 1);
});

test("public relevance score maps cross-encoder logits through a sigmoid", () => {
  assert.equal(sigmoid(0), 0.5);
  assert.equal(publicRelevanceScore({ crossEncoderScore: 0 }), 50);
  assert.ok(publicRelevanceScore({ crossEncoderScore: 4 }) > 90);
  assert.ok(publicRelevanceScore({ crossEncoderScore: -4 }) < 10);
});

test("public relevance score falls back to normalised RRF when reranking is inactive", () => {
  assert.equal(publicRelevanceScore({ _rrfScore: 0.05 }, 0.1), 50);
  assert.equal(publicRelevanceScore({ _rrfScore: 0.05 }, 0), 0);
});
