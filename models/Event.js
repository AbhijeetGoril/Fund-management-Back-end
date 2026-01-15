import mongoose from "mongoose";
const eventSchema= new mongoose.Schema({
  title:{
    type:String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description:{
    type:String,
    required: true,
  },
  society:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Society"
  },
  createdBy:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  }
},{ timestamps: true })
export default mongoose.model("Event",eventSchema)