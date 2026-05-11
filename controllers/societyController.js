import User from "../models/User.js";
import Society from "../models/Society.js";
import Event from "../models/Event/Event.js";
import { generateEventCategory } from "../services/geminiService.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Participant from "../models/Event/ParticipantSchema.js";
import cloudinary from "../config/cloudinary.js";


export const createSociety = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Society name is required" });
    }

    // Find the user in DB using firebaseUid from auth middleware
    const dbUser = await User.findOne({ firebaseUid: req.user.uid });
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check for duplicate society name (case-insensitive if needed)
    const existingSociety = await Society.findOne({ name });
    if (existingSociety) {
      return res.status(409).json({ message: "Society name already exists" });
    }

    // Optional: check if user is already a member of this society? (not applicable on creation)

    const society = await Society.create({
      name,
      members: [
        {
          user: dbUser._id,
          role: "admin",
        },
      ],
    });

    // Populate user details for response (optional but helpful)
    const populatedSociety = await Society.findById(society._id).populate(
      "members.user",
      "name email", // select only needed fields
    );

    res.status(201).json(populatedSociety);
  } catch (error) {
    // Handle known database errors
    if (error.code === 11000) {
      // Duplicate key error (if unique index is set on `name`)
      return res.status(409).json({ message: "Society name already exists" });
    }

    // Log error internally for debugging
    console.error("Create society error:", error);

    // Send generic message to client
    res.status(500).json({ message: "Internal server error" });
  }
};
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      date,
      description,
      societyId,
      location,
      budget,
    } = req.body;
    
    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    const dbUser = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!dbUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let society = null;

    if (societyId) {
      society = await Society.findById(
        societyId
      );

      if (!society) {
        return res.status(404).json({
          message: "Society not found",
        });
      }

      const isAdmin =
        society.members.some(
          (m) =>
            m.user.toString() ===
              dbUser._id.toString() &&
            m.role === "admin"
        );

      if (!isAdmin) {
        return res.status(403).json({
          message: "Admin access only",
        });
      }
    }

    let coverPhoto = "";
    if(req.file){
      const uploadedImage= await cloudinary.uploader.upload(
        req.file.path,
        {
        folder: "events",
        }
      )
      coverPhoto =
    uploadedImage.secure_url;
    }

    // AI category + description
    const aiData =
      await generateEventCategory(title);

    const event = await Event.create({
      title: title.trim(),

      date: date || Date.now(),

      description:
        description || aiData.description,

      category: aiData.category,
      
      society: society
        ? society._id
        : null,

      createdBy: dbUser._id,

      // OPTIONAL LOCATION
      location: location || "",

      // OPTIONAL BUDGET
      budget: {
        target: budget || 0,
      },

      coverPhoto,
    });

    res.status(201).json(event);

  } catch (error) {
    console.log(error.message);

    res.status(500).json({
      message: error.message,
    });
  }
};
export const getAllMyRelatedEvents = async (req, res) => {
  try {
    const memberships = await EventMember.find({
      user: req.user.id,
    });
    const memberEventIds = memberships.map((member) => member.event.toString());
    const events = await Event.find({
      $or: [{ createdBy: req.user.id }, { _id: { $in: memberEventIds } }],
    })
      .populate("createdBy", "name email")
      .populate("society", "name")
      .populate({
        path: "members",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });
    const updatedEvent = events.map((event) => {
      const myMemberData = event.members.find(
        (member) => member.user && member.user._id.toString() === req.user.id,
      );
      return {
        ...event.toObject(),
        isAdmin: myMemberData?.role === "admin",
      };
    });
    res.status(200).json({
      success: true,
      total: updatedEvent.length,
      events: updatedEvent,
    });
  } catch (error) {
    console.log(error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addParticipant = async (req, res) => {
  try {
    const { eventId, name, email, phone, amountToPay } = req.body;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }
    // -----------------------------
    // CHECK ADMIN ACCESS
    // -----------------------------

    const adminMember = await EventMember.findOne({
      event: eventId,
      user: req.user.id,
      role: "admin",
    });

    if (!adminMember) {
      return res.status(403).json({
        message: "Only event admin can add participants",
      });
    }

    // -----------------------------
    // NORMALIZE EMAIL
    // -----------------------------

    const normalizedEmail = email.trim().toLowerCase();

    // -----------------------------
    // CHECK DUPLICATE PARTICIPANT
    // -----------------------------

    const existingParticipant = await Participant.findOne({
      event: eventId,
      email: normalizedEmail,
    });

    if (existingParticipant) {
      return res.status(400).json({
        message: "Participant already exists",
      });
    }

    // -----------------------------
    // FIND REGISTERED USER
    // -----------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    // -----------------------------
    // CREATE EVENT MEMBER
    // -----------------------------

    if (existingUser) {
      const existingMember = await EventMember.findOne({
        event: eventId,
        user: existingUser._id,
      });

      if (!existingMember) {
        await EventMember.create({
          event: eventId,
          user: existingUser._id,
          role: "member",
        });
      }
    }

    // -----------------------------
    // CREATE PARTICIPANT
    // -----------------------------

    const participant = await Participant.create({
      event: eventId,
      user: existingUser?._id || null,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone || "",
      amountToPay: amountToPay || 0,
      amountPaid: 0,
    });

    res.status(201).json({
      success: true,
      participant,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};

export const getSingleEvent =async (req, res) => {
  try {
    const { eventId } = req.params;
    // -----------------------------
    // CHECK EVENT EXISTS
    // -----------------------------
    const event=await Event.findById(eventId).populate("createdBy", "name email")
      .lean();
    if(!event){
      return res.status(404).json({
        message: "Event not found",
      });
    }
    // -----------------------------
    // GET EVENT MEMBERS
    // -----------------------------
    const members=await EventMember.find({
      event:eventId
    }).populate("user", "name email")
      .lean();
    
    // -----------------------------
    // GET PARTICIPANTS
    // -----------------------------

    const participants = await Participant.find({
      event: eventId,
    })
      .populate("user", "name email")
      .lean();
    
    const totalAmountToPay=participants.reduce((sum,participant)=>{
      return sum+participant.amountToPay
    },0)
    const totalAmountPaid=participants.reduce((sum,participant)=>{
      return sum+participant.amountPaid
    },0)  
    const totalPendingAmount =
      totalAmountToPay - totalAmountPaid;
    
    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({
      success:true,
      event,
      members,
      participants,
      summary:{
        totalMembers: members.length,
        totalParticipants:
          participants.length,
        totalAmountToPay,

        totalAmountPaid,

        totalPendingAmount,
      }
    })
  
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};
