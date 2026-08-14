import mongoose from "mongoose";

const societySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "Residential",
        "Apartment Complex",
        "Gated Community",
        "Housing Society",
        "Cooperative Society",
        "Other",
      ],
      default: "Other",
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    logo: {
      type: String,
      default: "",
    },

    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },

    membershipPolicy: {
      type: String,
      enum: ["open", "approval_required"],
      default: "approval_required",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Society", societySchema);