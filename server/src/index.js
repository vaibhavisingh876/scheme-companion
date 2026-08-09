// ─── Load environment variables first ──────────────────────────────────
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { startMySchemeCron } from "./ingestion/jobs/myschemeCron.js";
import schemeRoutes from "./routes/schemeRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookmarkRoutes from "./routes/bookmarkRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import dns from "dns";

// dns.setDefaultResultOrder("ipv4first");

// ─── Validate required environment variables ────────────────────────────
const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "GROQ_API_KEY",
  "MYSCHEME_API_KEY",
];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missing.join(", ")}`
  );
  process.exit(1);
}

// ─── Start cron if enabled ─────────────────────────────────────────────
if (process.env.ENABLE_CRON === "true") {
  console.log("⏰ Cron enabled – starting scheduler...");
  // startMySchemeCron is now async – handle it safely
  startMySchemeCron().catch((err) =>
    console.error("❌ Cron startup error:", err)
  );
} else {
  console.log("⏸️ Cron is disabled (set ENABLE_CRON=true to enable)");
}

// ─── Express app ────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("CORS Policy Violation: Cross-Origin Access Denied"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use(apiLimiter);

// Request logger (only in non‑production)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`🔥 [${new Date().toISOString()}] REQUEST: ${req.method} ${req.url}`);
    next();
  });
}

// ─── Routes ─────────────────────────────────────────────────────────────
app.use("/api/schemes", schemeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);

app.get("/", (req, res) => {
  res.status(200).json({ status: "healthy", service: "Scheme Companion API Core" });
});

// ─── Global error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("🛑 Unhandled Core Pipeline Crash:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

// ─── Start server ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});