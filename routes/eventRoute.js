import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addParticipant, updateMember, getMemberDetails } from "../controllers/eventController.js";
import { recordPayment } from "../controllers/paymentController.js";
import upload from "../middleware/upload.js";



const router = express.Router();

// Add Participant update this also
router.post("/addParticipant", authMiddleware, addParticipant);
router.patch(
  "/:eventId/members/:memberId/payment",
  authMiddleware,
  upload.single("receiptImage"),  // <-- add this
  recordPayment
);
router.patch("/:eventId/members/:memberId", authMiddleware, updateMember);

// NOTE: this GET route must come AFTER the two PATCH routes above are
// registered — but since Express matches routes by method AND path
// together, a GET here won't collide with the PATCH routes on the same
// path pattern. Still placing it last for consistency with your
// documented convention of specific routes before generic ones.
router.get("/:eventId/members/:memberId", authMiddleware, getMemberDetails);

export default router;