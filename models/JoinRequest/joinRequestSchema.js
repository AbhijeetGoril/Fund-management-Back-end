import mongoose from "mongoose";

const joinRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["society", "event"],
      required: true,
    },

    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One PENDING request per user per target. Partial index so a
// rejected/approved request doesn't block the user from requesting
// again later — same pattern as EventMember's partial unique indexes.
joinRequestSchema.index(
  { user: 1, society: 1 },
  { unique: true, partialFilterExpression: { status: "pending", society: { $type: "objectId" } } }
);
joinRequestSchema.index(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: "pending", event: { $type: "objectId" } } }
);

joinRequestSchema.pre("validate", function (next) {
  if (this.type === "society" && !this.society) {
    return next(new Error("society is required when type is 'society'."));
  }
  if (this.type === "event" && !this.event) {
    return next(new Error("event is required when type is 'event'."));
  }
  next();
});

export default mongoose.model("JoinRequest", joinRequestSchema);