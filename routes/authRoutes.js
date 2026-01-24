import express from "express";

import { getMe, googleAuth, sendOtp,setPassword,verifyOtp } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router=express.Router()
router.post("/send-otp",sendOtp)
router.get("/me", authMiddleware, getMe);
router.post("/verify-otp", verifyOtp);
router.post("/set-password", setPassword);
router.post("/google", googleAuth);
export default router