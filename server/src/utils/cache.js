import NodeCache from "node-cache";

export const profileCache = new NodeCache({ stdTTL: 3600, checkperiod: 120, maxKeys: 5000 });
export const embeddingCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 5000 });
// Holds all active schemes + their embeddings for in-memory semantic scoring.
// Re-fetching ~4.7k embedding rows per request takes minutes over the wire, so
// keep them resident and refresh on a TTL. useClone:false avoids deep-copying
// the float arrays on every get.
export const candidateCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 4, useClone: false });