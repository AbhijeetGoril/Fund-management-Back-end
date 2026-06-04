// models/SocietyMember.js

import mongoose from "mongoose";

const societyMemberSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
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

// One user can have only one role per society
societyMemberSchema.index(
  { society: 1, user: 1 },
  { unique: true }
);

export default mongoose.model(
  "SocietyMember",
  societyMemberSchema
);