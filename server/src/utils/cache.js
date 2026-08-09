import NodeCache from "node-cache";

export const profileCache = new NodeCache({ stdTTL: 3600, checkperiod: 120, maxKeys: 5000 });
export const embeddingCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 5000 });