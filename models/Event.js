import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      required: true,
    },

    // OPTIONAL: event may or may not belong to a society
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null, // 👈 important for clarity
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
