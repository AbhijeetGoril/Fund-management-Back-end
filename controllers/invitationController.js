import Invitation from "../models/Invitation/invitationSchema.js";
import User from "../models/User.js";
import Event from "../models/Event/Event.js";
import Society from "../models/Society/Society.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import transporter from "../config/mailer.js";
import jwt from "jsonwebtoken";

export const inviteUser = async (req, res) => {
  try {
    const { email, type, society, event, amountToPay, message } = req.body;

    // Validate
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !type) {
      return res.status(400).json({
        success: false,
        message: "Email and type are required.",
      });
    }

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

    // Logged in user
    const invitedBy = await User.findById(req.user.id);

    if (!invitedBy) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    let existingEvent = null;
    let existingSociety = null;

    // Check target
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

    // Existing user
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    // Already a member of the event
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

    // Duplicate invitation
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
    const token = jwt.sign(
            { email: normalizedEmail, eventId: event._id, type: "event" },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
          );
    // Create invitation
    const invitation = await Invitation.create({
      email: normalizedEmail,
      user: existingUser?._id || null,
      invitedBy: invitedBy._id,
      type,
      society: society || null,
      event: event || null,
      amountToPay: amountToPay || 0,
      message: message || "",
      token
    });

    // Existing User
    if (existingUser) {
      return res.status(201).json({
        success: true,
        message: "Invitation sent successfully.",
        data: invitation,
      });
    }
   
    // New User - Send Email
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

          ${
            message
              ? `<p><strong>Message:</strong> ${message}</p>`
              : ""
          }

          ${
            amountToPay > 0
              ? `<p><strong>Amount:</strong> ₹${amountToPay}</p>`
              : ""
          }

          <br>

          <a
            href="${process.env.FRONTEND_URL}/signup"
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