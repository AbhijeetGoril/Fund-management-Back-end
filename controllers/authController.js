import bcrypt from "bcryptjs"
import Otp from "../models/Otp.js";

export const sendOtp  = async (req,res)=>{
  try {
    const {email}=req.body
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await Otp.deleteMany({email})
    await Otp.create({
      email,
      expiresAt,
      otpHash
    })
    res.json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}