import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      default: null, // set AFTER OTP verification
    },

    name: {
      type: String,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    upiId: {
      type: String,
      default: null, // e.g. "arungoril@okhdfcbank" — used to generate UPI payment links when this user is an admin collecting dues
    },

    address: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);