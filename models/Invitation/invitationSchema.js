import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    // Email of the invited person
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Existing user (null if not registered)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Who sent the invitation
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Invitation target
    type: {
      type: String,
      enum: ["society", "event"],
      required: true,
    },

    // Society (for society invitation OR society event)
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },

    // Event (individual event OR event inside a society)
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    // Optional amount to pay
    amountToPay: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Optional invitation message
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // Invitation status
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
      ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
invitationSchema.index({ email: 1 });
invitationSchema.index({ user: 1 });
invitationSchema.index({ invitedBy: 1 });
invitationSchema.index({ society: 1 });
invitationSchema.index({ event: 1 });
invitationSchema.index({ status: 1 });

export default mongoose.model("Invitation", invitationSchema);