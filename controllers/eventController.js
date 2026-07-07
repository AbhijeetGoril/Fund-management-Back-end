import jwt from "jsonwebtoken";
import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Invitation from "../models/Invitation/invitationSchema.js";
import User from "../models/User.js";

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

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required." });
    }
    if (amountToPay < 0) {
      return res.status(400).json({ success: false, message: "Amount cannot be negative." });
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const admin = await EventMember.findOne({
      event: eventId,
      user: req.user.id,
      role: "admin",
    });
    if (!admin) {
      return res.status(403).json({ success: false, message: "Only event admin can add participants." });
    }

    // =====================================================
    // OFFLINE PARTICIPANT (no email at all)
    // =====================================================
    if (!email) {
      if (!name?.trim()) {
        return res.status(400).json({ success: false, message: "Name is required for an offline participant." });
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
    // ONLINE / EMAIL FLOW
    // =====================================================
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (user && user._id.equals(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot add yourself as a participant." });
    }

    const pendingInvitation = await Invitation.findOne({
      event: event._id,
      email: normalizedEmail,
      status: "pending",
    });
    if (pendingInvitation) {
      return res.status(409).json({ success: false, message: "Invitation already sent." });
    }

    // Case A: registered user -> send a real invitation (needs acceptance)
    if (user) {
      const alreadyMember = await EventMember.findOne({ event: event._id, user: user._id });
      if (alreadyMember) {
        return res.status(409).json({ success: false, message: "User is already a participant." });
      }

      const token = jwt.sign(
        { email: normalizedEmail, eventId: event._id, type: "event" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const invitation = await Invitation.create({
        email: normalizedEmail,
        user: user._id,
        invitedBy: req.user.id,
        type: "event",
        event: event._id,
        amountToPay,
        message,
        token,
      });

      // TODO: Send invitation email here

      return res.status(201).json({
        success: true,
        message: "Invitation sent successfully.",
        invitation,
      });
    }

    // Case B: no account yet -> "online guest" participant, added directly (fixed: name check + members.push)
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    const alreadyGuest = await EventMember.findOne({ event: event._id, email: normalizedEmail });
    if (alreadyGuest) {
      return res.status(409).json({ success: false, message: "Participant already exists." });
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

    event.members.push(participant._id); // was missing before
    await event.save();

    return res.status(201).json({
      success: true,
      message: "The user has been successfully added to the participants.",
      participant,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};