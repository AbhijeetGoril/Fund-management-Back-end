// models/Participant.js
import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
  { timestamps: true }
);

// 🔥 AUTO-UPDATE paymentStatus
participantSchema.pre("save", function (next) {
  this.paymentStatus =
    this.amountPaid >= this.amountToPay ? "paid" : "pending";
  next();
});

// one user can participate only once per event
participantSchema.index({ event: 1, user: 1 }, { unique: true });

export default mongoose.model("Participant", participantSchema);
