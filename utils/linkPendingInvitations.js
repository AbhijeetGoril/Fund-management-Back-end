import Invitation from "../models/Invitation/invitationSchema.js";
import { createNotification } from "./createNotification.js";

/**
 * Call this right after a new user account is created.
 * Finds any pending invitations sent to this email BEFORE they had
 * an account, links their new user._id to those invitations, and
 * creates an in-app notification for each so they see it immediately.
 */
export const linkPendingInvitations = async (newUser) => {
  try {
    const normalizedEmail = newUser.email.toLowerCase();

    const pendingInvitations = await Invitation.find({
      email: normalizedEmail,
      user: null, // only ones that were sent before they had an account
      status: "pending",
    })
      .populate("event", "title")
      .populate("society", "name")
      .populate("invitedBy", "name");

    if (pendingInvitations.length === 0) return;

    for (const invitation of pendingInvitations) {
      // Link the invitation to their new account
      invitation.user = newUser._id;
      await invitation.save();

      // Notify them now that they have an account to receive it in
      await createNotification({
        recipient: newUser._id,
        sender: invitation.invitedBy?._id || null,
        type: "invitation_received",
        title:
          invitation.type === "event" ? "New Event Invitation" : "New Society Invitation",
        message:
          invitation.type === "event"
            ? `${invitation.invitedBy?.name || "Someone"} invited you to join "${invitation.event?.title}".`
            : `${invitation.invitedBy?.name || "Someone"} invited you to join "${invitation.society?.name}".`,
        relatedEvent: invitation.event?._id || null,
        relatedSociety: invitation.society?._id || null,
        relatedInvitation: invitation._id,
        link:
          invitation.type === "event"
            ? `/events/${invitation.event?._id}`
            : `/societies/${invitation.society?._id}`,
      });
    }
  } catch (error) {
    // Never let this break signup itself — just log it
    console.error("Link Pending Invitations Error:", error);
  }
};