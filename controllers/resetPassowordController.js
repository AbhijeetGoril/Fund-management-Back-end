
import transporter from "../config/mailer.js";
import Otp from "../models/Otp.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Generate OTP
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const otpHash = await bcrypt.hash(otp, 10);

    // OTP valid for 5 minutes
    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    // Remove old OTPs
    await Otp.deleteMany({ email });

    // Save new OTP
    await Otp.create({
      email,
      otpHash,
      expiresAt,
    });

    // Send email using Resend
    const { data, error } = await transporter.emails.send({
      from: "Society Manager <noreply@findmyroommates.in>",
      to: [email],
      subject: "Reset Password OTP",
      html: `
        <div style="font-family: Arial, sans-serif;"
          <h2>Password Reset</h2>

          <p>Your OTP for resetting your password is:</p>

          <h1 style="letter-spacing: 4px;">
            ${otp}
          </h1>

          <p>
            This OTP is valid for
            <strong>5 minutes</strong>.
          </p>

          <p>
            If you did not request this,
            please ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Resend error:", error);

      // Remove OTP if email failed
      await Otp.deleteOne({ email });

      return res.status(500).json({
        message: "Failed to send OTP email",
      });
    }

    console.log("✅ Reset OTP email sent:", data?.id);

    return res.status(200).json({
      message: "OTP sent to email",
    });

  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Verify Reset OTP
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otpDoc = await Otp.findOne({ email });

    if (!otpDoc) {
      return res.status(400).json({
        message: "OTP not found or expired",
      });
    }

    if (otpDoc.expiresAt < Date.now()) {
      await otpDoc.deleteOne();

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    const isValidOtp = await bcrypt.compare(
      otp,
      otpDoc.otpHash
    );

    if (!isValidOtp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // OTP verified → delete OTP
    await otpDoc.deleteOne();

    // Create reset token
    const resetToken = jwt.sign(
      {
        email,
        purpose: "reset-password",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m",
      }
    );

    // Set reset token cookie
    res.cookie("resetToken", resetToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000,
    });

    return res.status(200).json({
      message: "OTP verified. You can reset your password now.",
    });

  } catch (error) {
    console.error("verifyResetOtp error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.cookies.resetToken;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        message: "Reset session expired",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const decoded = jwt.verify(
      resetToken,
      process.env.JWT_SECRET
    );

    if (decoded.purpose !== "reset-password") {
      return res.status(403).json({
        message: "Invalid reset token",
      });
    }

    const user = await User.findOne({
      email: decoded.email,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.password = await bcrypt.hash(
      newPassword,
      10
    );

    await user.save();

    // Clear reset token cookie
    res.clearCookie("resetToken", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      message: "Password reset successful",
    });

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Reset session expired",
      });
    }

    console.error("resetPassword error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
