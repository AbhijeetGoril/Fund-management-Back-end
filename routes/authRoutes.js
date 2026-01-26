import express from "express";

import { getMe, googleAuth, login, logout, sendOtp,setPassword,verifyOtp } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { forgotPassword, verifyResetOtp } from "../controllers/resetPassowordController.js";

const router=express.Router()
router.post("/send-otp",sendOtp)
router.get("/me", authMiddleware, getMe);
router.post("/verify-otp", verifyOtp);
router.post("/set-password", setPassword);
router.post("/google", googleAuth);
router.post("/login", login);
router.post("/logout", logout);

router.post("/forget-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);


export default router