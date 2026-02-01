// models/EventMember.js
import mongoose from "mongoose";

const eventMemberSchema = new mongoose.Schema(
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

    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
  },
  { timestamps: true }
);

// one user can have only one role per event
eventMemberSchema.index({ event: 1, user: 1 }, { unique: true });

export default mongoose.model("EventMember", eventMemberSchema);
