import express from "express";
import { getNotifications, markAsRead } from "../controllers/notificationsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js"; // adjust to your actual middleware name/path

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.patch("/:id/read", authMiddleware, markAsRead);

export default router;