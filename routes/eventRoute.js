import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addParticipant } from "../controllers/eventController.js";

const router = express.Router();

// Add Participant
router.post("/addParticipant", authMiddleware, addParticipant);

export default router;