
import User from "../models/User.js";
import Society from "../models/Society.js";

export const createSociety = async (req, res) => {
  try {
    const { name } = req.body;
    if(!name){
       return res.status(400).json({ message: "Society name is required" });
    }
    const dbUser=await User.findOne({
       firebaseUid: req.user.uid,
    })
    if(!dbUser){
      return res.status(404).json({ message: "User not found" });
    }
    const society=await Society.create({
      name,
      members: [
        {
          user: dbUser._id,
          role: "admin",
        },
      ],
    })
    res.status(201).json(society);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};