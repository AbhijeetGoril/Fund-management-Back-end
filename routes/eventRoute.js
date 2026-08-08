import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addParticipant } from "../controllers/eventController.js";
import { recordPayment } from "../controllers/paymentController.js";

const router = express.Router();

// Add Participant
router.post("/addParticipant", authMiddleware, addParticipant);
router.patch("/:eventId/members/:memberId/payment", authMiddleware, recordPayment);

export default router;