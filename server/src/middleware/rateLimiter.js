import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// req.ip is Express's resolved client IP, respecting app.set('trust proxy', ...).
// Using ipKeyGenerator ensures IPv6 addresses are normalized correctly.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: "Too many query tracking requests originating from this identifier block. Please cool down tracking queries.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator, // ✅ uses req.ip internally with proper IPv6 handling
});

export const aiRouteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: "Rate limit threshold breached for conversational profile processing pipelines. Please try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator, // ✅ same
});