import jwt from "jsonwebtoken";
import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
// import { sendInvitationEmail } from "../utils/sendInvitationEmail.js";

export const addParticipant = async (req, res) => {
  try {
    const { eventId } = req.params;

    const {
      name,
      email,
      phone,
      amountToPay = 0,
      message = "",
    } = req.body;

    // =====================================================
    // Check Event
    // =====================================================

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // =====================================================
    // Only Event Admin Can Add Participants
    // =====================================================

    const admin = await EventMember.findOne({
      event: eventId,
      user: req.user._id,
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

        addedBy: req.user._id,
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

    // Generate JWT
    const token = jwt.sign(
      {
        email: normalizedEmail,
        eventId: event._id,
        type: "event",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Save invitation
    const invitation = await Invitation.create({
      email: normalizedEmail,

      user: user?._id || null,

      invitedBy: req.user._id,

      type: "event",

      event: event._id,

      amountToPay,

      message,

      token,
    });

    // =====================================================
    // Send Invitation Email
    // =====================================================

    /*
    await sendInvitationEmail({
        email: normalizedEmail,
        token,
        eventName: event.title,
    });
    */

    return res.status(201).json({
      success: true,
      message: user
        ? "Invitation sent successfully."
        : "Invitation sent. User must sign up first.",
      invitation,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};