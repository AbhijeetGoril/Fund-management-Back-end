import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addParticipant } from "../controllers/eventController.js";
import { recordPayment } from "../controllers/paymentController.js";
import { updateMember } from "../controllers/eventController.js";
import upload from "../middleware/upload.js";



const router = express.Router();

// Add Participant
router.post("/addParticipant", authMiddleware, addParticipant);
router.patch(
  "/:eventId/members/:memberId/payment",
  authMiddleware,
  upload.single("receiptImage"),  // <-- add this
  recordPayment
);
router.patch("/:eventId/members/:memberId", authMiddleware, updateMember);
export default router;