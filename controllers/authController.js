import bcrypt from "bcryptjs"
import Otp from "../models/Otp.js";
import transporter from "../config/mailer.js";
import User from "../models/User.js";


export const sendOtp  = async (req,res)=>{
  try {
    const {email}=req.body
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    // 🔍 check if user already exists & verified
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.emailVerified) {
      return res
        .status(400)
        .json({ message: "Email already verified. Please login." });
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
    await transporter.sendMail({
      from: `"Society App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
      `,
    })
    res.json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}