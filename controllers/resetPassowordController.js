import transporter from "../config/mailer.js";
import Otp from "../models/Otp.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 🔍 Check if user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔢 Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // ⏱ OTP valid for 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // ❌ Remove old OTPs
    await Otp.deleteMany({ email });

    // ✅ Save new OTP
    await Otp.create({
      email,
      otpHash,
      expiresAt,
    });

    // 📧 Send email
    await transporter.sendMail({
      from: `"Society App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password OTP",
      html: `
        <h2>Password Reset</h2>
        <p>Your OTP for resetting your password is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    return res.status(200).json({
      message: "OTP sent to email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1️⃣ Basic validation
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // 2️⃣ Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3️⃣ Find OTP record
    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) {
      return res.status(400).json({ message: "OTP not found or expired" });
    }

    // 4️⃣ Check expiry
    if (otpDoc.expiresAt < Date.now()) {
      await otpDoc.deleteOne();
      return res.status(400).json({ message: "OTP expired" });
    }

    // 5️⃣ Compare OTP (hashed)
    const isValidOtp = await bcrypt.compare(otp, otpDoc.otpHash);
    if (!isValidOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 6️⃣ OTP verified → delete OTP
    await otpDoc.deleteOne();

    // 7️⃣ Create short-lived reset token
    const resetToken = jwt.sign(
      { email, purpose: "reset-password" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.status(200).json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
