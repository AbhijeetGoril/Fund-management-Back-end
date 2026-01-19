import express from "express";

import { googleAuth, sendOtp,setPassword,verifyOtp } from "../../controllers/authController.js";
const router=express.Router()
router.post("/send-otp",sendOtp)
router.post("/verify-otp", verifyOtp);
router.post("/set-password", setPassword);
router.post("/google", googleAuth);
export default router