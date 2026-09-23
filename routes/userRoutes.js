import express from "express";
import { createUser, updateProfile } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", createUser);
router.put("/profile", authMiddleware, updateProfile);

export default router;