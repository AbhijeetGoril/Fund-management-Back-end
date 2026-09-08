import Invitation from "../models/Invitation/invitationSchema.js";
import User from "../models/User.js";
import Event from "../models/Event/Event.js";
import Society from "../models/Society/Society.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import transporter from "../config/mailer.js";
import jwt from "jsonwebtoken";
import { createNotification } from "../utils/createNotification.js";
import SocietyMember from "../models/Society/societyMemberSchema.js";
import { isEventOrSocietyAdmin } from "./eventController.js";

export const inviteUser = async (req, res) => {
  try {
    const { email, type, society, event, amountToPay, dueDate, message } = req.body;

    if (!email || !type) {
      return res.status(400).json({
        success: false,
        message: "Email and type are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (type === "event" && !event) {
      return res.status(400).json({
        success: false,
        message: "Event is required.",
      });
    }

    if (type === "society" && !society) {
      return res.status(400).json({
        success: false,
        message: "Society is required.",
      });
    }

    const invitedBy = await User.findById(req.user.id);
    if (!invitedBy) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    let existingEvent = null;
    let existingSociety = null;

    if (type === "event") {
      existingEvent = await Event.findById(event);
      if (!existingEvent) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }
    }

    if (type === "society") {
      existingSociety = await Society.findById(society);
      if (!existingSociety) {
        return res.status(404).json({
          success: false,
          message: "Society not found.",
        });
      }
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (type === "event" && existingUser) {
      const existingEventMember = await EventMember.findOne({
        event,
        user: existingUser._id,
      });

      if (existingEventMember) {
        return res.status(400).json({
          success: false,
          message: "User is already a member of this event.",
        });
      }
    }

    const duplicateInvitation = await Invitation.findOne({
      email: normalizedEmail,
      type,
      society: society || null,
      event: event || null,
      status: "pending",
    });

    if (duplicateInvitation) {
      return res.status(400).json({
        success: false,
        message: "Invitation already sent.",
      });
    }

    // FIX: only sign a token for event invites, and use the fetched
    // document's _id (existingEvent) — `event` here is just the raw ID
    // string from req.body, so `event._id` would be undefined and this
    // was also crashing for society invites where `event` doesn't exist.
    let token = null;
    if (type === "event") {
      token = jwt.sign(
        { email: normalizedEmail, eventId: existingEvent._id, type: "event" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
    }

    const invitation = await Invitation.create({
      email: normalizedEmail,
      user: existingUser?._id || null,
      invitedBy: invitedBy._id,
      type,
      society: society || null,
      event: event || null,
      amountToPay: amountToPay || 0,
      dueDate: dueDate || null,
      message: message || "",
      token,
    });

    // Existing User -> in-app notification, no email needed
    if (existingUser) {
      await createNotification({
        recipient: existingUser._id,
        sender: invitedBy._id,
        type: "invitation_received",
        title:
          type === "event" ? "New Event Invitation" : "New Society Invitation",
        message:
          type === "event"
            ? `${invitedBy.name} invited you to join "${existingEvent.title}".`
            : `${invitedBy.name} invited you to join "${existingSociety.name}".`,
        relatedEvent: type === "event" ? existingEvent._id : null,
        relatedSociety: type === "society" ? existingSociety._id : null,
        relatedInvitation: invitation._id,
        link:
          type === "event"
            ? `/events/${existingEvent._id}`
            : `/societies/${existingSociety._id}`,
      });

      return res.status(201).json({
        success: true,
        message: "Invitation sent successfully.",
        data: invitation,
      });
    }

    // New User - Send Email (no account yet, so no in-app notification is possible)
    await transporter.sendMail({
      from: `"Fund Management" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "You're Invited!",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">

          <h2 style="color:#4F46E5;">
            🎉 You're Invited!
          </h2>

          <p>Hello,</p>

          <p>
            <strong>${invitedBy.name}</strong> invited you to join a
            <strong>${type}</strong>.
          </p>

          ${
            type === "event"
              ? `<p><strong>Event:</strong> ${existingEvent.title}</p>`
              : `<p><strong>Society:</strong> ${existingSociety.name}</p>`
          }

          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}

          ${amountToPay > 0 ? `<p><strong>Amount:</strong> ₹${amountToPay}</p>` : ""}

          ${dueDate ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ""}

          <br>

          
            href="${process.env.FRONTEND_URL}signup"
            style="
              display:inline-block;
              padding:12px 24px;
              background:#4F46E5;
              color:#fff;
              text-decoration:none;
              border-radius:8px;
            "
          >
            Create Account
          </a>

          <br><br>

          <p>
            After signing up with this email, you'll find your invitation
            inside your dashboard.
          </p>

          <hr>

          <small>
            If you weren't expecting this invitation, you can safely ignore this email.
          </small>

        </div>
      `,
    });

    return res.status(201).json({
      success: true,
      message: "Invitation email sent successfully.",
      data: invitation,
    });
  } catch (error) {
    console.error("Invite User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message,
    });
  }
};



// =====================================================
// PATCH /api/invitations/:id/accept
// =====================================================
export const acceptInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invitation = await Invitation.findById(id)
      .populate("event")
      .populate("society")
      .populate("invitedBy");
   
   
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Invitation already ${invitation.status}.`,
      });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Ownership check — only the invited person can accept it
    const isOwner =
      (invitation.user && invitation.user.toString() === currentUser._id.toString()) ||
      invitation.email === currentUser.email.toLowerCase();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to accept this invitation.",
      });
    }

    let newParticipant = null;

    // Event-type invitation -> create the actual EventMember
    if (invitation.type === "event") {
      const alreadyMember = await EventMember.findOne({
        event: invitation.event._id,
        user: currentUser._id,
      });

      if (!alreadyMember) {
        newParticipant = await EventMember.create({
          event: invitation.event._id,
          user: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          amountToPay: invitation.amountToPay || 0,
          dueDate: invitation.dueDate || null,
          role: "member",
          status: "active",
          addedBy: invitation.invitedBy._id,
          invitedBy: invitation.invitedBy._id,
        });

        await Event.findByIdAndUpdate(invitation.event._id, {
          $push: { members: newParticipant._id },
        });
      } else {
        newParticipant = alreadyMember;
      }
    }

    // Society-type invitation -> create the actual SocietyMember
    if (invitation.type === "society") {
      const alreadyMember = await SocietyMember.findOne({
        society: invitation.society._id,
        user: currentUser._id,
      });

      if (!alreadyMember) {
        newParticipant = await SocietyMember.create({
          society: invitation.society._id,
          user: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          role: "member",
          status: "active",
          addedBy: invitation.invitedBy._id,
          invitedBy: invitation.invitedBy._id,
        });

        await Society.findByIdAndUpdate(invitation.society._id, {
          $push: { members: newParticipant._id },
        });
      } else {
        newParticipant = alreadyMember;
      }
    }

    invitation.status = "accepted";
    invitation.user = invitation.user || currentUser._id;
    await invitation.save();

    // Notify the person who sent the invite
    await createNotification({
      recipient: invitation.invitedBy._id,
      sender: currentUser._id,
      type: "invitation_accepted",
      title: "Invitation Accepted",
      message: `${currentUser.name} accepted your invitation${
        invitation.event
          ? ` to "${invitation.event.title}"`
          : invitation.society
          ? ` to join "${invitation.society.name}"`
          : ""
      }.`,
      relatedEvent: invitation.event?._id || null,
      relatedSociety: invitation.society?._id || null,
      relatedInvitation: invitation._id,
      link: invitation.event
        ? `/events/${invitation.event._id}`
        : invitation.society
        ? `/society/${invitation.society._id}`
        : null,
    });

    // Notify all OTHER existing event members that someone new joined
    if (invitation.type === "event" && newParticipant) {
      const existingMembers = await EventMember.find({
        event: invitation.event._id,
        user: { $ne: null },
      });

      await Promise.all(
        existingMembers
          .filter((m) => m.user.toString() !== currentUser._id.toString())
          .map((m) =>
            createNotification({
              recipient: m.user,
              sender: currentUser._id,
              type: "participant_added",
              title: "New Participant Joined",
              message: `${currentUser.name} joined "${invitation.event.title}".`,
              relatedEvent: invitation.event._id,
              link: `/events/${invitation.event._id}`,
            })
          )
      );
    }

    // Notify all OTHER existing society members that someone new joined
    if (invitation.type === "society" && newParticipant) {
      const existingMembers = await SocietyMember.find({
        society: invitation.society._id,
        user: { $ne: null },
      });

      await Promise.all(
        existingMembers
          .filter((m) => m.user.toString() !== currentUser._id.toString())
          .map((m) =>
            createNotification({
              recipient: m.user,
              sender: currentUser._id,
              type: "participant_added",
              title: "New Member Joined",
              message: `${currentUser.name} joined "${invitation.society.name}".`,
              relatedSociety: invitation.society._id,
              link: `/society/${invitation.society._id}`,
            })
          )
      );
    }

    return res.status(200).json({
      success: true,
      message: "Invitation accepted.",
      invitation,
      participant: newParticipant,
    });
  } catch (error) {
    console.error("Accept Invitation Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// =====================================================
// PATCH /api/invitations/:id/reject
// =====================================================
export const rejectInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await Invitation.findById(id)
      .populate("event")
      .populate("society")
      .populate("invitedBy");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Invitation already ${invitation.status}.`,
      });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isOwner =
      (invitation.user && invitation.user.toString() === currentUser._id.toString()) ||
      invitation.email === currentUser.email.toLowerCase();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this invitation.",
      });
    }

    invitation.status = "rejected";
    await invitation.save();

    // Notify the sender that it was rejected
    await createNotification({
      recipient: invitation.invitedBy._id,
      sender: currentUser._id,
      type: "invitation_rejected",
      title: "Invitation Rejected",
      message: `${currentUser.name} rejected your invitation${
        invitation.event ? ` to "${invitation.event.title}"` : ""
      }.`,
      relatedEvent: invitation.event?._id || null,
      relatedSociety: invitation.society?._id || null,
      relatedInvitation: invitation._id,
    });

    return res.status(200).json({
      success: true,
      message: "Invitation rejected.",
      invitation,
    });
  } catch (error) {
    console.error("Reject Invitation Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// PATCH /api/invitations/:id/cancel
// Only the admin who SENT the invitation can cancel it,
// and only while it's still pending.
// =====================================================
export const cancelInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await Invitation.findById(id).populate("invitedBy");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found.",
      });
    }

    // Only the person who SENT it can cancel it
    if (invitation.invitedBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this invitation.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Cannot cancel — invitation already ${invitation.status}.`,
      });
    }

    invitation.status = "cancelled";
    await invitation.save();

    return res.status(200).json({
      success: true,
      message: "Invitation cancelled successfully.",
      invitation,
    });
  } catch (error) {
    console.error("Cancel Invitation Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// GET /api/invitations/sent
// Lists every invitation the logged-in user has personally sent,
// across all events and societies, regardless of status — sorted
// newest first.
// =====================================================
export const getSentInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({ invitedBy: req.user.id })
      .populate("event", "title")
      .populate("society", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invitations,
    });
  } catch (error) {
    console.error("Get Sent Invitations Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /api/invitations/event/:eventId/pending
// Lists every still-pending invitation for this event, so admins can
// see who's been invited but hasn't accepted yet. Accessible by any
// event or society admin, not just whoever originally sent each invite
// (unlike cancelInvitation, which is sender-only).
// =====================================================
export const getPendingInvitationsForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const authorized = await isEventOrSocietyAdmin(event, req.user.id);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: "Only event or society admin can view pending invitations.",
      });
    }

    const pendingInvitations = await Invitation.find({
      event: eventId,
      type: "event",
      status: "pending",
    })
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invitations: pendingInvitations,
    });
  } catch (error) {
    console.error("Get Pending Invitations Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};