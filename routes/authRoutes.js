import express from "express";

import { sendOtp,setPassword,verifyOtp } from "../controllers/authController.js";
const router=express.Router()
router.post("/send-otp",sendOtp)
router.post("/verify-otp", verifyOtp);
router.post("/set-password", setPassword);
export default router