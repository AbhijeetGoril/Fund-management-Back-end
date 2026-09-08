import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { approveJoinRequest, rejectJoinRequest, cancelJoinRequest } from "../controllers/joinRequestController.js";

const router = express.Router();

router.patch("/:id/approve", authMiddleware, approveJoinRequest);
router.patch("/:id/reject", authMiddleware, rejectJoinRequest);
router.patch("/:id/cancel", authMiddleware, cancelJoinRequest);

export default router;