// src/utils/logger.js
//
// Minimal drop-in logger. Not a "logging library" in the pino/winston sense —
// deliberately kept tiny since the ask was "not overly engineered". Swap this
// for pino later if you need log shipping/structured JSON logs in prod; the
// call sites (logger.info/warn/error/debug) won't need to change.

const isProd = process.env.NODE_ENV === "production";
const ts = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[INFO  ${ts()}]`, ...args),
  warn: (...args) => console.warn(`[WARN  ${ts()}]`, ...args),
  error: (...args) => console.error(`[ERROR ${ts()}]`, ...args),
  // debug is silenced in production so verbose per-request logs
  // (profile extraction, candidate counts, etc.) don't flood prod logs.
  debug: (...args) => {
    if (!isProd) console.log(`[DEBUG ${ts()}]`, ...args);
  },
};