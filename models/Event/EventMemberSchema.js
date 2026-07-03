import mongoose from "mongoose";

const eventMemberSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // Null if the person doesn't have an account
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Snapshot information
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      default: null,
      trim: true,
    },

    // Permission in this event
    role: {
      type: String,
      enum: ["admin", "member", "participant"],
      default: "participant",
    },

    // Member status
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "declined",
        "active",
        "removed",
      ],
      default: "active",
    },

    amountToPay: {
      type: Number,
      default: 0,
      min: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid"],
      default: "pending",
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Prevent duplicate registered users in the same event
eventMemberSchema.index(
  { event: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: "objectId" },
    },
  }
);

// Prevent duplicate guest emails in the same event
eventMemberSchema.index(
  { event: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string" },
    },
  }
);

eventMemberSchema.pre("save", function (next) {
  if (this.amountPaid <= 0) {
    this.paymentStatus = "pending";
  } else if (this.amountPaid < this.amountToPay) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "paid";
  }

  next();
});

export default mongoose.model("EventMember", eventMemberSchema);