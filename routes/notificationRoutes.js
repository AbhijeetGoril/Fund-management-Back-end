import express from "express";
import { getNotifications, markAsRead,markAllAsRead } from "../controllers/notificationsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js"; // adjust to your actual middleware name/path

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.patch("/:id/read", authMiddleware, markAsRead);
router.patch("/read-all", authMiddleware, markAllAsRead);

export default router;