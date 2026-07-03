import mongoose from "mongoose";
import EventMember from "./EventMemberSchema.js";

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
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EventMember",
      },
    ],
    coverPhoto: {
      type: String,
      default: "",
    },

    photos: [
      {
        type: String,
      },
    ],
  },

  { timestamps: true },
);

eventSchema.post("save", async function (doc, next) {
  try {
    const exists = await EventMember.findOne({
      event: doc._id,
      user: doc.createdBy,
    });

    if (!exists) {
      const member = await EventMember.create({
        event: doc._id,
        user: doc.createdBy,
        role: "admin",
      });
      // 🔥 add member id into event.members
      doc.members.push(member._id);
      await doc.save();
    }

    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Event", eventSchema);
