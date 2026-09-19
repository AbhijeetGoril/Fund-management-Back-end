import express from "express";
import { askHelpBot } from "../controllers/helpBotController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, askHelpBot);

export default router;