import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },

    // For "direct": exactly 2 user ids. For "group": every current
    // member's user id, kept in sync when members are added/removed —
    // this is what makes "which conversations does user X see" a
    // single indexed query instead of a join through Society/EventMember.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Only for "group" — which society/event this conversation belongs to
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

    lastMessage: {
      text: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      sentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Fast lookup of "all conversations this user is part of", sorted by activity
conversationSchema.index({ participants: 1, "lastMessage.sentAt": -1 });

// One group conversation per society, one per standalone event
conversationSchema.index(
  { type: 1, society: 1 },
  { unique: true, partialFilterExpression: { type: "group", society: { $type: "objectId" } } }
);
conversationSchema.index(
  { type: 1, event: 1 },
  { unique: true, partialFilterExpression: { type: "group", event: { $type: "objectId" } } }
);

export default mongoose.model("Conversation", conversationSchema);