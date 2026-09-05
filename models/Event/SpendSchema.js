// models/Spend.js

import mongoose from "mongoose";

const spendSchema = new mongoose.Schema(
  {
    // Event reference
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // Optional user reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Spend title
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Spend amount
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Category
    category: {
      type: String,
      enum: [
        "Food",
        "Travel",
        "Decoration",
        "Equipment",
        "Venue",
        "Marketing",
        "Photography",
        "Transport",
        "Maintenance",
        "Emergency",
        "Entertainment",
        "Other",
      ],
      default: "Other",
    },

    // Who actually paid
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Vendor / shop / person
    paidTo: {
      type: String,
      default: "",
      trim: true,
    },

    // Who created spend entry
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Which admin approved spend
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Approval status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Spend date
    spendDate: {
      type: Date,
      default: Date.now,
    },

    // Receipt details
    receiptNumber: {
      type: String,
      default: "",
      trim: true,
    },

    receiptImage: {
      type: String,
      default: "",
    },

    // Extra details
    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // Future split expense feature
    splitBetween: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Participant",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Spend", spendSchema);