import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyConversations,
  getMessages,
  getOrCreateDirectConversation,
  getOrCreateSocietyConversation,
  getOrCreateEventConversation,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/conversations", authMiddleware, getMyConversations);
router.get("/conversations/:id/messages", authMiddleware, getMessages);
router.post("/direct/:userId", authMiddleware, getOrCreateDirectConversation);
router.get("/society/:societyId", authMiddleware, getOrCreateSocietyConversation);
router.get("/event/:eventId", authMiddleware, getOrCreateEventConversation);

export default router;