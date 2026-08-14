import User from "../models/User.js";
import Society from "../models/Society/Society.js";
import Event from "../models/Event/Event.js";
import { generateEventCategory } from "../services/geminiService.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Participant from "../models/Event/ParticipantSchema.js";
import cloudinary from "../config/cloudinary.js";
// controllers/spendController.js
import Spend from "../models/Event/SpendSchema.js";

import SocietyMember from "../models/Society/societyMemberSchema.js";

export const createSociety = async (req, res) => {
  try {
    const { name, category, description, location, privacy, membershipPolicy } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Society name is required",
      });
    }

    if (!location?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Location is required",
      });
    }

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingSociety = await Society.findOne({ name: name.trim() });
    if (existingSociety) {
      return res.status(409).json({
        success: false,
        message: "Society name already exists",
      });
    }

    let logo = "";
    if (req.file) {
      const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
        folder: "societies",
      });
      logo = uploadedImage.secure_url;
    }

    const society = await Society.create({
      name: name.trim(),
      category: category || "Other",
      description: description?.trim() || "",
      location: location.trim(),
      logo,
      privacy: privacy === "public" ? "public" : "private",
      membershipPolicy: membershipPolicy === "open" ? "open" : "approval_required",
      createdBy: dbUser._id,
    });

    await SocietyMember.create({
      society: society._id,
      user: dbUser._id,
      role: "admin",
    });

    const populatedSociety = await Society.findById(society._id).populate(
      "createdBy",
      "name email"
    );

    res.status(201).json({
      success: true,
      message: "Society created successfully",
      society: populatedSociety,
    });
  } catch (error) {
    console.error("Create society error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Society name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const createEvent = async (req, res) => {
  try {
    const { title, date, description, societyId, location, budget } = req.body;

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
      society = await Society.findById(societyId);

      if (!society) {
        return res.status(404).json({
          message: "Society not found",
        });
      }

      const isAdmin = society.members.some(
        (m) =>
          m.user.toString() === dbUser._id.toString() && m.role === "admin",
      );

      if (!isAdmin) {
        return res.status(403).json({
          message: "Admin access only",
        });
      }
    }

    let coverPhoto = "";
    if (req.file) {
      const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
        folder: "events",
      });
      coverPhoto = uploadedImage.secure_url;
    }

    // AI category + description
    const aiData = await generateEventCategory(title);

    const event = await Event.create({
      title: title.trim(),

      date: date || Date.now(),

      description: description || aiData.description,

      category: aiData.category,

      society: society ? society._id : null,

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



export const getSingleEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    // -----------------------------
    // CHECK EVENT EXISTS
    // -----------------------------
    const event = await Event.findById(eventId)
      .populate("createdBy", "name email")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // -----------------------------
    // GET ALL EVENT MEMBERS (no status filter — full history included)
    // -----------------------------
    const members = await EventMember.find({
      event: eventId,
    })
      .populate("user", "name email")
      .lean();

    // "Participants" for financial totals = anyone with a payment
    // obligation, regardless of role — an admin can also owe money.
    const payingMembers = members.filter((m) => m.amountToPay > 0);

    // "Participants" for the members-list display = role-based
    const participantsByRole = members.filter((m) => m.role === "participant");

    const totalAmountToPay = payingMembers.reduce(
      (sum, m) => sum + (m.amountToPay || 0),
      0
    );
    const totalAmountPaid = payingMembers.reduce(
      (sum, m) => sum + (m.amountPaid || 0),
      0
    );
    const totalPendingAmount = totalAmountToPay - totalAmountPaid;

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: true,
      event,
      members,
      participants: participantsByRole,
      summary: {
        totalMembers: members.length,
        totalParticipants: participantsByRole.length,
        totalPayingMembers: payingMembers.length,
        totalAmountToPay,
        totalAmountPaid,
        totalPendingAmount,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// =====================================================
// GET /societies/allMySocieties
// =====================================================
export const getAllMySocieties = async (req, res) => {
  try {
    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const memberships = await SocietyMember.find({ user: dbUser._id });
    const societyIds = memberships.map((m) => m.society);

    const societies = await Society.find({ _id: { $in: societyIds } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Attach role + event count + basic totals per society
    const enriched = await Promise.all(
      societies.map(async (society) => {
        const myMembership = memberships.find(
          (m) => m.society.toString() === society._id.toString()
        );

        const events = await Event.find({ society: society._id })
          .select("title budget status")
          .lean();

        const totalCollected = events.reduce(
          (sum, e) => sum + (e.budget?.collected || 0),
          0
        );

        return {
          ...society,
          role: myMembership?.role || "member",
          isAdmin: myMembership?.role === "admin",
          totalEvents: events.length,
          totalCollected,
          events,
        };
      })
    );

    return res.status(200).json({
      success: true,
      total: enriched.length,
      societies: enriched,
    });
  } catch (error) {
    console.error("Get All My Societies Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};