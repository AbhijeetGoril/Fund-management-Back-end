import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { linkPendingInvitations } from "../utils/linkPendingInvitations.js"; // ADDED

export const createUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Signup token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔐 HARD BLOCK
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

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      emailVerified: true,
    });

    // ADDED: link any invitations sent to this email before they had
    // an account, and create in-app notifications for them now
    await linkPendingInvitations(user);

    // 🍪 login cookie
    const loginToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

   res.cookie("authToken", loginToken, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

    return res.status(201).json({
      message: "Signup completed successfully",
      user,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Signup token expired" });
    }
    console.log(error.message);
    return res.status(500).json({ message: error.message });
  }
};



const UPI_PATTERN = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

// PUT /api/users/profile
// body: { name?: string, upiId?: string, address?: string }
const updateProfile = async (req, res) => {
  try {
    const { name, upiId, address } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      updates.name = name.trim();
    }

    if (upiId !== undefined) {
      if (!upiId.trim() || !UPI_PATTERN.test(upiId.trim())) {
        return res.status(400).json({ error: "That doesn't look like a valid UPI ID (expected format: name@bank)" });
      }
      updates.upiId = upiId.trim();
    }

    if (address !== undefined) {
      updates.address = address.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      select: "-password",
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error("[user] updateProfile error:", error);
    return res.status(500).json({ error: "Could not update profile. Please try again." });
  }
};

export { updateProfile };