import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { approveJoinRequest, rejectJoinRequest } from "../controllers/joinRequestController.js";

const router = express.Router();

router.patch("/:id/approve", authMiddleware, approveJoinRequest);
router.patch("/:id/reject", authMiddleware, rejectJoinRequest);

export default router;