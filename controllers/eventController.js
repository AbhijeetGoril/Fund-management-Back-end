import jwt from "jsonwebtoken";
import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import SocietyMember from "../models/Society/societyMemberSchema.js";
import Invitation from "../models/Invitation/invitationSchema.js";
import User from "../models/User.js";
import { createNotification } from "../utils/createNotification.js";
import Payment from "../models/Event/PaymentSchema.js"

// Helper: notify all existing event members (with real accounts) that
// someone new was added. Skips the admin who just performed the action.
const notifyExistingMembers = async ({ event, newParticipant, actingAdminId }) => {
  const existingMembers = await EventMember.find({
    event: event._id,
    user: { $ne: null }, // only members who have real accounts
  });

  await Promise.all(
    existingMembers
      .filter((m) => m.user.toString() !== actingAdminId.toString())
      .map((m) =>
        createNotification({
          recipient: m.user,
          sender: actingAdminId,
          type: "participant_added",
          title: "New Participant Joined",
          message: `${newParticipant.name} was added to "${event.title}".`,
          relatedEvent: event._id,
          link: `/events/${event._id}`,
        })
      )
  );
};

// Helper: notify all OTHER existing event members (with real accounts)
// that a member's details were updated. Skips the admin who just
// performed the action AND the member who was just edited (they get
// their own personal notice separately, if applicable).
// NOTE: reuses "event_updated" as the type since the Notification
// model's enum doesn't currently have a dedicated "member_updated"
// value. Consider adding one later for clearer distinction in the UI.
const notifyMembersOfUpdate = async ({ event, updatedMember, actingAdminId }) => {
  const existingMembers = await EventMember.find({
    event: event._id,
    user: { $ne: null },
    _id: { $ne: updatedMember._id },
  });

  await Promise.all(
    existingMembers
      .filter((m) => m.user.toString() !== actingAdminId.toString())
      .map((m) =>
        createNotification({
          recipient: m.user,
          sender: actingAdminId,
          type: "event_updated",
          title: "Member Details Updated",
          message: `${updatedMember.name || "A member"}'s details were updated in "${event.title}".`,
          relatedEvent: event._id,
          link: `/events/${event._id}`,
        })
      )
  );
};

// Helper: is this user an admin of this event, EITHER directly as an
// EventMember admin, OR as the admin of the society this event belongs to.
// EXPORTED so getMemberDetails (below) can reuse the same permission logic.
export const isEventOrSocietyAdmin = async (event, userId) => {
  if (event.society) {
    const societyAdmin = await SocietyMember.findOne({
      society: event.society,
      user: userId,
      role: "admin",
    });
    if (societyAdmin) return true;
  }

  const eventAdmin = await EventMember.findOne({
    event: event._id,
    user: userId,
    role: "admin",
  });
  return !!eventAdmin;
};

export const addParticipant = async (req, res) => {
  try {
    const {
      eventId,
      name,
      email,
      phone,
      amountToPay = 0,
      dueDate,
      message = "",
    } = req.body;
    console.log("duedate",dueDate)
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

    // UPDATED: society admin OR event admin can add participants
    const authorized = await isEventOrSocietyAdmin(event, req.user.id);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: "Only event or society admin can add participants.",
      });
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
        dueDate: dueDate || null,
        role: "participant",
        status: "active",
        addedBy: req.user.id,
      });

      event.members.push(participant._id);
      await event.save();

      await notifyExistingMembers({
        event,
        newParticipant: participant,
        actingAdminId: req.user.id,
      });

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

      // NOTE: dueDate is stored on the Invitation here so it can be
      // carried over to the EventMember once accepted. This requires
      // Invitation's schema to have a dueDate field (Date, default
      // null) — add it if it isn't there yet, the same way amountToPay
      // is already stored on Invitation.
      const invitation = await Invitation.create({
        email: normalizedEmail,
        user: user._id,
        invitedBy: req.user.id,
        type: "event",
        event: event._id,
        amountToPay,
        dueDate: dueDate || null,
        message,
        token,
      });

      await createNotification({
        recipient: user._id,
        sender: req.user.id,
        type: "invitation_received",
        title: "New Event Invitation",
        message: `You've been invited to join "${event.title}".`,
        relatedEvent: event._id,
        relatedInvitation: invitation._id,
        link: `/invitations/${invitation._id}`,
      });

      // NOTE: existing members are NOT notified here — this person
      // hasn't actually joined yet, only been invited. That trigger
      // belongs in acceptInvitation, once they actually accept.

      return res.status(201).json({
        success: true,
        message: "Invitation sent successfully.",
        invitation,
      });
    }

    // Case B: no account yet -> "online guest" participant, added directly
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
      dueDate: dueDate || null,
      role: "participant",
      status: "active",
      addedBy: req.user.id,
      email: normalizedEmail,
    });

    event.members.push(participant._id);
    await event.save();

    await notifyExistingMembers({
      event,
      newParticipant: participant,
      actingAdminId: req.user.id,
    });

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

export const updateMember = async (req, res) => {
  try {
    const { eventId, memberId } = req.params;
    const { name, phone, amountToPay, amountPaid, role, dueDate } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    // UPDATED: society admin OR event admin can edit members
    const authorized = await isEventOrSocietyAdmin(event, req.user.id);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: "Only event or society admin can edit members.",
      });
    }

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const member = await EventMember.findOne({ _id: memberId, event: eventId });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this event.",
      });
    }

    if (role && !["admin", "member", "participant"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role.",
      });
    }

    if (role && role !== "admin" && member.role === "admin") {
      const adminCount = await EventMember.countDocuments({
        event: eventId,
        role: "admin",
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot change role — this is the only admin left for this event.",
        });
      }
    }

    if (amountToPay !== undefined) {
      const amt = Number(amountToPay);
      if (isNaN(amt) || amt < 0) {
        return res.status(400).json({
          success: false,
          message: "Amount to pay must be a non-negative number.",
        });
      }
      member.amountToPay = amt;
    }

    // Track the previous value BEFORE we overwrite it, so we can log
    // the delta as a "correction" Payment entry below. This keeps the
    // audit trail (sum of all Payment records) in sync with
    // EventMember.amountPaid even when an admin corrects a mistake
    // here instead of recording a real new payment via the Pay button.
    const previousAmountPaid = member.amountPaid;

    if (amountPaid !== undefined) {
      const paid = Number(amountPaid);
      if (isNaN(paid) || paid < 0) {
        return res.status(400).json({
          success: false,
          message: "Amount paid must be a non-negative number.",
        });
      }
      member.amountPaid = paid;
    }

    if (name !== undefined) member.name = name.trim();
    if (phone !== undefined) member.phone = phone.trim() || null;
    if (role !== undefined) member.role = role;
    if (dueDate !== undefined) member.dueDate = dueDate || null;

    await member.save();

    // Log the correction AFTER a successful save, so we never create a
    // Payment record for a member update that failed validation above.
    if (amountPaid !== undefined) {
      const delta = member.amountPaid - previousAmountPaid;
      if (delta !== 0) {
        await Payment.create({
          targetType: "event",
          type: "correction",
          eventMember: member._id,
          event: member.event,
          amount: delta, // signed — negative for a downward correction
          recordedBy: dbUser._id,
          method: "other",
          note: "Manual correction via Edit Member",
        });
      }
    }

    // ── Notifications ──────────────────────────────────────────────
    // 1) Personal notice to the member whose record just changed —
    //    only if they have an account and aren't the one making the edit.
    if (member.user && member.user.toString() !== dbUser._id.toString()) {
      await createNotification({
        recipient: member.user,
        sender: dbUser._id,
        type: "event_updated",
        title: "Your Details Were Updated",
        message: `${dbUser.name} updated your details in "${event.title}".`,
        relatedEvent: event._id,
        link: `/events/${event._id}`,
      });
    }

    // 2) Broadcast to every OTHER member of this event (excluding the
    //    actor and the member who was just edited).
    await notifyMembersOfUpdate({
      event,
      updatedMember: member,
      actingAdminId: dbUser._id,
    });
    // ──────────────────────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      message: "Member updated successfully.",
      member,
    });
  } catch (error) {
    console.error("Update Member Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /events/:eventId/members/:memberId
 *
 * Returns one member's full record plus their complete payment history
 * (both real payments and manual corrections), newest first.
 *
 * Accessible by: the event/society admin, OR the member themself
 * (if they have a linked account and are viewing their own record).
 */
export const getMemberDetails = async (req, res) => {
  try {
    const { eventId, memberId } = req.params;

    const event = await Event.findById(eventId).populate("society", "name");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const member = await EventMember.findOne({ _id: memberId, event: eventId })
      .populate("user", "name email")
      .populate("addedBy", "name email");

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found in this event." });
    }

    const isSelf = member.user && member.user._id.toString() === req.user.id;
    const authorized = await isEventOrSocietyAdmin(event, req.user.id);

    if (!authorized && !isSelf) {
      return res.status(403).json({
        success: false,
        message: "You're not authorized to view this member's details.",
      });
    }

    const payments = await Payment.find({ eventMember: memberId })
      .populate("recordedBy", "name email")
      .sort({ paymentDate: -1 });

    return res.status(200).json({
      success: true,
      event: { _id: event._id, title: event.title, society: event.society },
      member,
      payments,
    });
  } catch (error) {
    console.error("Get Member Details Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};