import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    // 🔥 ADDED CATEGORY
    category: {
      type: String,
      enum: [
        "Personal",
        "Travel",
        "Health",
        "Tech",
        "Education",
        "Finance",
        "Maintenance",
        "Cultural",
        "Sports",
        "Social",
        "Meeting",
        "Emergency",
        "Other",
      ],
      default: "Other",
    },

    date: {
      type: Date,
      default: Date.now,
    },

    location: {
      type: String, // from your UI (Community Hall)
    },

    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔥 EXISTING
    budget: {
      target: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);