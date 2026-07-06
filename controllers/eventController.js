import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Invitation from "../models/Invitation/invitationSchema.js";
import User from "../models/User.js";
// import { sendInvitationEmail } from "../utils/sendInvitationEmail.js";

export const addParticipant = async (req, res) => {
  try {
    const {
      eventId,
      name,
      email,
      phone,
      amountToPay = 0,
      message = "",
    } = req.body;

    // =====================================================
    // Check Event
    // =====================================================
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required.",
      });
    }
    if (amountToPay < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative.",
      });
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address.",
        });
      }
    }
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // =================================X====================
    // Only Event Admin Can Add Participants
    // =====================================================

    const admin = await EventMember.findOne({
      event: eventId,
      user: req.user.id,
      role: "admin",
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Only event admin can add participants.",
      });
    }

    // =====================================================
    // OFFLINE PARTICIPANT
    // =====================================================

    if (!email) {
      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name is required.",
        });
      }

      const participant = await EventMember.create({
        event: event._id,
        user: null,

        name: name.trim(),
        phone: phone?.trim() || null,

        amountToPay,

        role: "participant",

        status: "active",

        addedBy: req.user.id,
      });

      event.members.push(participant._id);
      await event.save();

      return res.status(201).json({
        success: true,
        message: "Participant added successfully.",
        participant,
      });
    }

    // =====================================================
    // EMAIL FLOW
    // =====================================================

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const user = await User.findOne({
      email: normalizedEmail,
    });
    // Already participant?
    if (user && user._id.equals(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot add yourself as a participant.",
      });
    }
    // Pending invitation
    const pendingInvitation = await Invitation.findOne({
      event: event._id,
      email: normalizedEmail,
      status: "pending",
    });

    if (pendingInvitation) {
      return res.status(409).json({
        success: false,
        message: "Invitation already sent.",
      });
    }

    if (user) {
      const alreadyMember = await EventMember.findOne({
        event: event._id,
        user: user._id,
      });

      if (alreadyMember) {
        return res.status(409).json({
          success: false,
          message: "User is already a participant.",
        });
      }

      // Create invitation
      const invitation = await Invitation.create({
        email: normalizedEmail,
        user: user._id,
        invitedBy: req.user.id,
        type: "event",
        event: event._id,
        amountToPay,
        message,
      });

      // TODO: Send invitation email here

      return res.status(201).json({
        success: true,
        message: "Invitation sent successfully.",
        invitation,
      });
    } else {
      const alreadyGuest = await EventMember.findOne({
        event: event._id,
        email: normalizedEmail,
      });

      if (alreadyGuest) {
        return res.status(409).json({
          success: false,
          message: "Participant already exists.",
        });
      }
    }

    const participant = await EventMember.create({
      event: event._id,
      user: null,

      name: name.trim(),
      phone: phone?.trim() || null,

      amountToPay,

      role: "participant",

      status: "active",

      addedBy: req.user.id,

      email: normalizedEmail,
    });

    return res.status(201).json({
      success: true,
      message: "The user has been successfully added to the participants.",
      participant,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
