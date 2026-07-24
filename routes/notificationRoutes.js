import express from "express";
import { getNotifications } from "../controllers/notificationsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js"; // adjust to your actual middleware name/path

const router = express.Router();

router.get("/", authMiddleware, getNotifications);

export default router;