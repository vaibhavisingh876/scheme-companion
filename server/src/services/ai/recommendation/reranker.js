// Lazy local cross-encoder reranking. Transformers.js is already used by the
// embedding pipeline, so this adds no runtime dependency or hosted API call.
// If model loading is disabled or unavailable, the hybrid RRF order remains a
// safe fallback and the response reports that reranking was inactive.
import { pipeline } from "@xenova/transformers";

const ENABLED = process.env.RERANKER_ENABLED !== "false";
const MODEL = process.env.RERANKER_MODEL || "Xenova/ms-marco-MiniLM-L-6-v2";
let classifierPromise;
let active = false;

const getClassifier = async () => {
  if (!ENABLED) return null;
  if (!classifierPromise) {
    classifierPromise = pipeline("text-classification", MODEL, { quantized: true })
      .then((model) => {
        active = true;
        console.log(`[reranker] loaded ${MODEL}`);
        return model;
      })
      .catch((error) => {
        classifierPromise = null;
        console.warn(`[reranker] unable to load ${MODEL}; using RRF order:`, error.message);
        return null;
      });
  }
  return classifierPromise;
};

const passageFor = (scheme) =>
  [scheme.name, scheme.description, scheme.eligibility]
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);

const scoreOf = (output) => {
  const rows = Array.isArray(output?.[0]) ? output[0] : Array.isArray(output) ? output : [output];
  const relevant = rows.find((row) => /label_1|relevant|positive/i.test(row?.label || ""));
  const row = relevant || rows[0];
  return Number.isFinite(row?.score) ? row.score : null;
};

export const rerank = async (query, candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const model = await getClassifier();
  if (!model) return candidates.map((candidate) => ({ ...candidate, reranked: false }));

  try {
    const ranked = [];
    // Keep inference bounded on CPU and avoid loading dozens of passages into
    // memory at once. Candidate count is capped by the recommendation service.
    for (let start = 0; start < candidates.length; start += 4) {
      const batch = candidates.slice(start, start + 4);
      const scores = await Promise.all(batch.map(async (candidate) => {
        const output = await model({ text: query, text_pair: passageFor(candidate) }, {
          truncation: true,
          max_length: 512,
        });
        return scoreOf(output);
      }));
      batch.forEach((candidate, offset) => ranked.push({
        ...candidate,
        crossEncoderScore: scores[offset],
        _rerankIndex: start + offset,
        reranked: true,
      }));
    }
    if (ranked.some((candidate) => candidate.crossEncoderScore == null)) {
      throw new Error("model returned an invalid relevance score");
    }
    return ranked.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);
  } catch (error) {
    console.warn("[reranker] scoring failed; using RRF order:", error.message);
    active = false;
    return candidates.map((candidate) => ({ ...candidate, reranked: false }));
  }
};

export const isRerankerActive = () => active;
