import express from "express";
import { getAllSchemes, searchSchemes, } from "../controllers/schemecontroller.js";

const router = express.Router();

router.get("/", getAllSchemes);
router.post("/search", searchSchemes);

export default router;