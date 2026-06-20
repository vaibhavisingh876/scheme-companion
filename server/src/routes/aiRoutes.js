import express from "express";
import { extractProfile } from "../controllers/aiController.js";
import { aiRouteLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/extract-profile", aiRouteLimiter, extractProfile);

export default router;