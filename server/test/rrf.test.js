import test from "node:test";
import assert from "node:assert/strict";
import { reciprocalRankFusion } from "../src/services/ai/recommendation/rrf.js";

test("documents appearing in both lists outrank single-list documents", () => {
  const fused = reciprocalRankFusion([
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    [{ id: "c" }, { id: "d" }],
  ]);
  assert.equal(fused[0].id, "c");
  assert.ok(fused[0].rrfScore > fused[1].rrfScore);
});

test("ranks are 1-based and scores follow 1/(k+rank)", () => {
  const fused = reciprocalRankFusion([[{ id: "only" }]], 60);
  assert.equal(fused[0].ranks[0], 1);
  assert.equal(fused[0].rrfScore, 1 / 61);
});

test("ignores empty lists and malformed entries", () => {
  const fused = reciprocalRankFusion([[{ id: "a" }, null, {}], null, []]);
  assert.deepEqual(fused.map((entry) => entry.id), ["a"]);
});
