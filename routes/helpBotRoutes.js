import express from "express";
import { askHelpBot } from "../controllers/helpBotController.js";

const router = express.Router();

// TODO: import your real auth middleware, e.g.:
// import { protect } from "../middleware/authMiddleware.js";
// router.post("/", protect, askHelpBot);

router.post("/", askHelpBot);

export default router;