import NodeCache from "node-cache";

export const profileCache = new NodeCache({ stdTTL: 3600, checkperiod: 120, maxKeys: 5000 });
export const embeddingCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 5000 });
// Holds all active schemes + their embeddings for in-memory semantic scoring.
// Keep them resident in memory (stdTTL: 0) to avoid expensive remote database re-fetches.
// useClone: false avoids deep-copying the float arrays on every get.
export const candidateCache = new NodeCache({ stdTTL: 0, checkperiod: 0, maxKeys: 4, useClone: false });