// models/Participant.js

import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // optional because guest may not have account
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // snapshot info
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: false,
      default: "",
      trim: true,
    },

    amountToPay: {
      type: Number,
      default: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "pending"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// Prevent same email joining same event multiple times
participantSchema.index({ event: 1, email: 1 }, { unique: true });

// Auto update payment status
participantSchema.pre("save", async function () {
  this.paymentStatus = this.amountPaid >= this.amountToPay ? "paid" : "pending";
});

export default mongoose.model("Participant", participantSchema);
