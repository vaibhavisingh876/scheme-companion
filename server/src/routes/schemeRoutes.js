import express from "express";
import { getAllSchemes, searchSchemes } from "../controllers/schemecontroller.js";

const router = express.Router();

// GET /api/schemes — paginated list (agar pehle se hai to use rakho)
router.get("/", getAllSchemes);

// POST /api/schemes/search — manual filter search (ye naya route hai)
router.post("/search", searchSchemes);

export default router;