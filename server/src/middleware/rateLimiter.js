import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: "Too many query tracking requests originating from this identifier block. Please cool down tracking queries.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers["x-forwarded-for"] || req.socket.remoteAddress,
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
  keyGenerator: (req) => req.headers["x-forwarded-for"] || req.socket.remoteAddress,
});