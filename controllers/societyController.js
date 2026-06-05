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
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Society name is required",
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

    const existingSociety = await Society.findOne({
      name: name.trim(),
    });

    if (existingSociety) {
      return res.status(409).json({
        message: "Society name already exists",
      });
    }

    // Create society
    const society = await Society.create({
      name: name.trim(),
      createdBy: dbUser._id,
    });

    // Add creator as admin
    await SocietyMember.create({
      society: society._id,
      user: dbUser._id,
      role: "admin",
    });

    const populatedSociety = await Society.findById(society._id).populate(
      "createdBy",
      "name email",
    );

    res.status(201).json({
      message: "Society created successfully",
      society: populatedSociety,
    });
  } catch (error) {
    console.error("Create society error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Society name already exists",
      });
    }

    res.status(500).json({
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
        message: "Event not found",
      });
    }
    // -----------------------------
    // GET EVENT MEMBERS
    // -----------------------------
    const members = await EventMember.find({
      event: eventId,
    })
      .populate("user", "name email")
      .lean();

    // -----------------------------
    // GET PARTICIPANTS
    // -----------------------------

    const participants = await Participant.find({
      event: eventId,
    })
      .populate("user", "name email")
      .lean();

    const totalAmountToPay = participants.reduce((sum, participant) => {
      return sum + participant.amountToPay;
    }, 0);
    const totalAmountPaid = participants.reduce((sum, participant) => {
      return sum + participant.amountPaid;
    }, 0);
    const totalPendingAmount = totalAmountToPay - totalAmountPaid;

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: true,
      event,
      members,
      participants,
      summary: {
        totalMembers: members.length,
        totalParticipants: participants.length,
        totalAmountToPay,

        totalAmountPaid,

        totalPendingAmount,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};

export const addSpend = async (req, res) => {
  try {
    const {
      event,
      title,
      amount,
      category,
      paidBy,
      paidTo,
      notes,
      spendDate,
      receiptNumber,
    } = req.body;
    if (!event || !title || !amount || !paidBy) {
      return res.status(400).json({
        success: false,
        message: "Event, title, amount and paidBy are required",
      });
    }
    const dbUser = await User.findById(req.user.id);

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // Find event
    const existingEvent = await Event.findById(event);
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // =================================
    // Permission Check
    // =================================

    if (existingEvent.society) {
      const societyAdmin = await SocietyMember.findOne({
        society: existingEvent.society,
        user: dbUser._id,
        role: "admin",
      });
      if (!societyAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only society admins can add spends",
        });
      }
    } else {
      // Individual Event
      console.log("eventId:", existingEvent._id)
      console.log("user:",dbUser._id)
      const eventAdmin = await EventMember.findOne({
        event: existingEvent._id,
        user: dbUser._id,
        role: "admin",
      });

      if (!eventAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only event admins can add spends",
        });
      }
    }
    let receiptImage = "";
    if (req.file) {
      const uploadedImage =await cloudinary.uploader.upload(req.file.path, {
        folder: "spends",
      });
      receiptImage =
        uploadedImage.secure_url;
    }
    // =================================
    // Create Spend
    // =================================

    const spend = await Spend.create({
      event,
      title: title.trim(),
      amount:Number(amount),
      category: category || "Other",
      paidBy,
      paidTo: paidTo || "",
      notes: notes || "",
      spendDate: spendDate || Date.now(),
      receiptNumber: receiptNumber || "",
      receiptImage,
      createdBy: dbUser._id,
    });

    return res.status(201).json({
      success: true,
      message: "Spend added successfully",
      data: spend,
    });
  } catch (error) {
    console.error("Add Spend Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add spend",
      error: error.message,
    });
  }
};
