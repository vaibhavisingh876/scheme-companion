import express from "express";
import { getAllSchemes, searchSchemes, } from "../controllers/schemecontroller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect); 
router.get("/", getAllSchemes);
router.post("/search", searchSchemes);

export default router;