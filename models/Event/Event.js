import mongoose from "mongoose";
import EventMember from "./EventMemberSchema.js";
import User from "../User.js";

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

    location: String,

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

    photos: [String],
  },
  { timestamps: true }
);

eventSchema.post("save", async function (doc, next) {
  try {
    const exists = await EventMember.findOne({
      event: doc._id,
      user: doc.createdBy,
    });

    if (exists) return next();

    const user = await User.findById(doc.createdBy);

    if (!user) return next();

    const member = await EventMember.create({
      event: doc._id,
      user: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "admin",
      status: "active",
      addedBy: user._id,
    });

    // Don't call doc.save() here
    await mongoose.model("Event").updateOne(
      { _id: doc._id },
      {
        $push: {
          members: member._id,
        },
      }
    );

    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Event", eventSchema);