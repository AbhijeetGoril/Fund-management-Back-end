import express from "express"
import { suggestDescription } from "../controllers/aiController.js"
const router=express.Router();
router.post("/suggest-description",suggestDescription)
export default router;