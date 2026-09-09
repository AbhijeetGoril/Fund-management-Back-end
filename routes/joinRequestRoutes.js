import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  approveJoinRequest,
  rejectJoinRequest,
  cancelJoinRequest,
  getReceivedJoinRequests,
  getSentJoinRequests,
} from "../controllers/joinRequestController.js";

const router = express.Router();

router.get("/received", authMiddleware, getReceivedJoinRequests);
router.get("/sent", authMiddleware, getSentJoinRequests);
router.patch("/:id/approve", authMiddleware, approveJoinRequest);
router.patch("/:id/reject", authMiddleware, rejectJoinRequest);
router.patch("/:id/cancel", authMiddleware, cancelJoinRequest);

export default router;