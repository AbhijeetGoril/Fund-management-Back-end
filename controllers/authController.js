import bcrypt from "bcryptjs";
import Otp from "../models/Otp.js";
import transporter from "../config/mailer.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import admin from "../config/firebase.js";

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
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
    await Otp.deleteMany({ email });
    await Otp.create({
      email,
      expiresAt,
      otpHash,
    });
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
    });
    res.json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and OTP are required" });
    }

    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP not found or expired" });
    }

    // ⏰ Check expiry
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }

    // 🔍 Validate OTP
    const isValidOtp = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValidOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // ✅ OTP verified → remove record
    await Otp.deleteOne({ email });

    // 🔐 Short-lived signup token
    const signupToken = jwt.sign(
      {
        email,
        otpVerified: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    res.json({
      message: "OTP verified successfully",
      signupToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




export const setPassword = async (req, res) => {
  try {
    // 🔐 Check signup token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Signup token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.otpVerified) {
      return res.status(403).json({ message: "OTP not verified" });
    }

    const { password, name = "" } = req.body;
    const email = decoded.email; // ✅ email ONLY from token

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // 🚫 Prevent duplicate users
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      emailVerified: true,
    });

    // 🍪 Login cookie
    const loginToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", loginToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "Signup completed successfully",
      user,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Signup token expired" });
    }
    res.status(500).json({ message: error.message });
  }
};

