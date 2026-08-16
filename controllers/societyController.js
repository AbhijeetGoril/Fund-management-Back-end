import User from "../models/User.js";
import Society from "../models/Society/Society.js";
import Event from "../models/Event/Event.js";
import { generateEventCategory } from "../services/geminiService.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Participant from "../models/Event/ParticipantSchema.js";
import cloudinary from "../config/cloudinary.js";
// controllers/spendController.js
import Spend from "../models/Event/SpendSchema.js";

import Invitation from "../models/Invitation/invitationSchema.js";
import jwt from "jsonwebtoken";
import { createNotification } from "../utils/createNotification.js";

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

    // FIX: added addedBy + status — required now that SocietyMember
    // schema was extended to support offline/guest members too.
    await SocietyMember.create({
      society: society._id,
      user: dbUser._id,
      role: "admin",
      addedBy: dbUser._id,
      status: "active",
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


// Notify all existing society members (with real accounts) that
// someone new was added. Skips the admin who just performed the action.
const notifyExistingSocietyMembers = async ({ society, newMemberName, actingAdminId }) => {
  const existingMembers = await SocietyMember.find({
    society: society._id,
    user: { $ne: null },
  });

  await Promise.all(
    existingMembers
      .filter((m) => m.user.toString() !== actingAdminId.toString())
      .map((m) =>
        createNotification({
          recipient: m.user,
          sender: actingAdminId,
          type: "participant_added",
          title: "New Society Member",
          message: `${newMemberName} was added to "${society.name}".`,
          relatedSociety: society._id,
          link: `/society/${society._id}`,
        })
      )
  );
};

// =====================================================
// POST /societies/addMember
// Body: { societyId, name, email, phone, role }
// Mirrors addParticipant exactly:
//  - No email -> offline member added directly
//  - Email + existing user -> invitation sent (needs acceptance)
//  - Email + no existing user -> "online guest" member added directly
// =====================================================
export const addSocietyMember = async (req, res) => {
  try {
    const { societyId, name, email, phone, role = "member" } = req.body;

    if (!societyId) {
      return res.status(400).json({ success: false, message: "Society ID is required." });
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
    }
    if (role && !["admin", "member"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    const society = await Society.findById(societyId);
    if (!society) {
      return res.status(404).json({ success: false, message: "Society not found." });
    }

    const admin = await SocietyMember.findOne({
      society: societyId,
      user: req.user.id,
      role: "admin",
    });
    if (!admin) {
      return res.status(403).json({ success: false, message: "Only society admin can add members." });
    }

    // =====================================================
    // OFFLINE MEMBER (no email at all)
    // =====================================================
    if (!email) {
      if (!name?.trim()) {
        return res.status(400).json({ success: false, message: "Name is required for an offline member." });
      }

      const member = await SocietyMember.create({
        society: society._id,
        user: null,
        name: name.trim(),
        phone: phone?.trim() || null,
        role,
        status: "active",
        addedBy: req.user.id,
      });

      await notifyExistingSocietyMembers({
        society,
        newMemberName: member.name,
        actingAdminId: req.user.id,
      });

      return res.status(201).json({
        success: true,
        message: "Member added successfully.",
        member,
      });
    }

    // =====================================================
    // ONLINE / EMAIL FLOW
    // =====================================================
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (user && user._id.equals(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot add yourself as a member." });
    }

    const pendingInvitation = await Invitation.findOne({
      society: society._id,
      email: normalizedEmail,
      status: "pending",
    });
    if (pendingInvitation) {
      return res.status(409).json({ success: false, message: "Invitation already sent." });
    }

    // Case A: registered user -> send a real invitation (needs acceptance)
    if (user) {
      const alreadyMember = await SocietyMember.findOne({ society: society._id, user: user._id });
      if (alreadyMember) {
        return res.status(409).json({ success: false, message: "User is already a member." });
      }

      const token = jwt.sign(
        { email: normalizedEmail, societyId: society._id, type: "society" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const invitation = await Invitation.create({
        email: normalizedEmail,
        user: user._id,
        invitedBy: req.user.id,
        type: "society",
        society: society._id,
        message: "",
        token,
      });

      await createNotification({
        recipient: user._id,
        sender: req.user.id,
        type: "invitation_received",
        title: "New Society Invitation",
        message: `You've been invited to join "${society.name}".`,
        relatedSociety: society._id,
        relatedInvitation: invitation._id,
        link: `/invitations/${invitation._id}`,
      });

      return res.status(201).json({
        success: true,
        message: "Invitation sent successfully.",
        invitation,
      });
    }

    // Case B: no account yet -> "online guest" member, added directly
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    const alreadyGuest = await SocietyMember.findOne({ society: society._id, email: normalizedEmail });
    if (alreadyGuest) {
      return res.status(409).json({ success: false, message: "Member already exists." });
    }

    const member = await SocietyMember.create({
      society: society._id,
      user: null,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      role,
      status: "active",
      addedBy: req.user.id,
    });

    await notifyExistingSocietyMembers({
      society,
      newMemberName: member.name,
      actingAdminId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "The user has been successfully added to the society.",
      member,
    });
  } catch (error) {
    console.error("Add Society Member Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// =====================================================
// GET /societies/:societyId
// Full society detail — info, members, events
// =====================================================
export const getSocietyDetail = async (req, res) => {
  try {
    const { societyId } = req.params;
    console.log(societyId)
    const society = await Society.findById(societyId)
      .populate("createdBy", "name email")
      .lean();

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found.",
      });
    }

    // Must be a member to view details
    const membership = await SocietyMember.findOne({
      society: societyId,
      user: req.user.id,
    });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this society.",
      });
    }

    const members = await SocietyMember.find({ society: societyId })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const events = await Event.find({ society: societyId })
      .select("title description category date location status coverPhoto budget")
      .sort({ date: -1 })
      .lean();

    const activeEvents = events.filter(
      (e) => (e.status || "active").toLowerCase() === "active"
    ).length;

    const totalCollected = events.reduce(
      (sum, e) => sum + (e.budget?.collected || 0),
      0
    );

    return res.status(200).json({
      success: true,
      society,
      members,
      events,
      isAdmin: membership.role === "admin",
      summary: {
        totalMembers: members.length,
        totalAdmins: members.filter((m) => m.role === "admin").length,
        totalEvents: events.length,
        activeEvents,
        totalCollected,
      },
    });
  } catch (error) {
    console.error("Get Society Detail Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};