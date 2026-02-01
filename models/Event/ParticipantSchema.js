// models/Participant.js
import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // registered user (optional)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // 👈 null means NOT registered
    },

    // guest / snapshot info
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
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
  { timestamps: true }
);

// auto update paymentStatus
participantSchema.pre("save", function (next) {
  this.paymentStatus =
    this.amountPaid >= this.amountToPay ? "paid" : "pending";
  next();
});

export default mongoose.model("Participant", participantSchema);
