
import User from "../models/User.js";
import Society from "../models/Society.js";
import Event from "../models/Event/Event.js";
import { generateEventCategory } from "../services/geminiService.js";

export const createSociety = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Society name is required' });
    }

    // Find the user in DB using firebaseUid from auth middleware
    const dbUser = await User.findOne({ firebaseUid: req.user.uid });
    if (!dbUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for duplicate society name (case-insensitive if needed)
    const existingSociety = await Society.findOne({ name });
    if (existingSociety) {
      return res.status(409).json({ message: 'Society name already exists' });
    }

    // Optional: check if user is already a member of this society? (not applicable on creation)

    const society = await Society.create({
      name,
      members: [
        {
          user: dbUser._id,
          role: 'admin',
        },
      ],
    });

    // Populate user details for response (optional but helpful)
    const populatedSociety = await Society.findById(society._id).populate(
      'members.user',
      'name email' // select only needed fields
    );

    res.status(201).json(populatedSociety);
  } catch (error) {
    // Handle known database errors
    if (error.code === 11000) {
      // Duplicate key error (if unique index is set on `name`)
      return res.status(409).json({ message: 'Society name already exists' });
    }

    // Log error internally for debugging
    console.error('Create society error:', error);

    // Send generic message to client
    res.status(500).json({ message: 'Internal server error' });
  }
};
export const createEvent = async (req, res) => {
  try {
    const { title, date, description, societyId } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const dbUser = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let society = null;

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

    // 🔥 FIXED
    const aiData = await generateEventCategory(title);

    const event = await Event.create({
      title,
      date,
      description: description || aiData.description,
      category: aiData.category,
      society: society ? society._id : null,
      createdBy: dbUser._id,
    });

    res.status(201).json(event);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};