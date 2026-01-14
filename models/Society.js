import mongoose from "mongoose";
const societySchema=new mongoose.Schema({
  name:{
    type:String,
    required: true,
    trim: true,
  },
  members: [
      {
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
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
},{ timestamps: true })
export default mongoose.model("Society", societySchema);