
import User from "../models/User.js";
import Society from "../models/Society.js";
import Event from "../models/Event/Event.js";

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
export const createEvent = async (req, res) => {
  try {
    const { title, date, description, societyId } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }

    // logged-in user
    const dbUser = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let society = null;

    // 👉 only run this if societyId is provided
    if (societyId) {
      society = await Society.findById(societyId);

      if (!society) {
        return res.status(404).json({ message: "Society not found" });
      }

      const isAdmin = society.members.some(
        (m) =>
          m.user.toString() === dbUser._id.toString() &&
          m.role === "admin"
      );

      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access only" });
      }
    }

    // ✅ create event (with or without society)
    const event = await Event.create({
      title,
      date,
      description,
      society: society ? society._id : null,
      createdBy: dbUser._id,
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};