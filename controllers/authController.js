import bcrypt from "bcryptjs";
import Otp from "../models/Otp.js";
import transporter from "../config/mailer.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";



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
      return res.status(400).json({ message: "Email and Otp is required" });
    }
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP not found or expired" });
    }
    // check expiry
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }
    const isValidotp = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValidotp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    // OTP is valid → email verified
    await Otp.deleteOne({ email });
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        emailVerified: true,
      });
    } else {
      user.emailVerified = true;
      await user.save();
    }
    const signupToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    res.json({
      message: "Email verified successfully",
      signupToken
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setPassword = async (req, res) => {
  try {
    
    const authHeader=req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoad=jwt.verify(token,process.env.JWT_SECRET)
    const email = decoad.email;
    // 3️⃣ Validate password
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

     // 4️⃣ Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    // 5️⃣ Hash & save password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password set successfully" });

  } catch (error) {
     if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Signup token expired" });
    }
    res.status(500).json({ message: error.message });
  }
};
