import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { startMySchemeCron } from "./ingestion/jobs/myschemeCron.js";
import schemeRoutes from "./routes/schemeRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookmarkRoutes from "./routes/bookmarkRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first"); // 👈 Bypasses Indian ISP blocks for Neon
dotenv.config();

if (process.env.ENABLE_CRON === "true") {
  startMySchemeCron();
}

const app = express();

// Safe array checks allowing cross-ports connections smoothly
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests or internal preflights)
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

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`🔥 [${new Date().toISOString()}] REQUEST:`, req.method, req.url);
    next();
  });
}

// Global Core API Sub-Routes
app.use("/api/schemes", schemeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);

app.get("/", (req, res) => {
  res.status(200).json({ status: "healthy", service: "Scheme Companion API Core" });
});

app.use((err, req, res, next) => {
  console.error("🛑 Unhandled Core Pipeline Crash Encountered:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Internal Server Execution Interrupted" : err.message,
  });
});

const PORT = process.env.PORT || 5000;
// Direct local network mapping to avoid IPv6 socket drops
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 System Engine initialized successfully over operational port [${PORT}]`);
});