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
      required: function () {
        return this.type === "society";
      },
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      required: function () {
        return this.type === "event";
      },
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

joinRequestSchema.index(
  { user: 1, society: 1 },
  { unique: true, partialFilterExpression: { status: "pending", society: { $type: "objectId" } } }
);
joinRequestSchema.index(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: "pending", event: { $type: "objectId" } } }
);

export default mongoose.model("JoinRequest", joinRequestSchema);