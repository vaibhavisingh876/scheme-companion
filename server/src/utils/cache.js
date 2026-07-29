// src/utils/cache.js
//
// `node-cache` was already in package.json but unused. This gives you cheap
// in-process caching for the two most expensive repeated operations in the
// recommendation pipeline: the Groq profile-extraction call (external API,
// network latency + cost) and the local embedding inference (CPU-bound).
//
// This is process-local (not shared across server instances/restarts). If
// you scale to multiple instances behind a load balancer, swap this for the
// `ioredis` client you already depend on — same get/set/del shape, so the
// call sites in groqService.js / recommendationService.js won't need to
// change much.

import NodeCache from "node-cache";

export const profileCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 5000 });
export const embeddingCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 5000 });