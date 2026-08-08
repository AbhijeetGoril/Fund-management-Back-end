import EventMember from "../models/Event/EventMemberSchema.js";
import { createNotification } from "../utils/createNotification.js";

// =====================================================
// PATCH /api/events/:eventId/members/:memberId/payment
// Admin records a payment against a member's balance.
// Body: { amountPaid } -- the amount to ADD to what they've already paid
// =====================================================
export const recordPayment = async (req, res) => {
  try {
    const { eventId, memberId } = req.params;
    const { amountPaid } = req.body;

    if (amountPaid === undefined || amountPaid === null) {
      return res.status(400).json({
        success: false,
        message: "amountPaid is required.",
      });
    }

    const amount = Number(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amountPaid must be a positive number.",
      });
    }

    // Only event admins can record payments
    const admin = await EventMember.findOne({
      event: eventId,
      user: req.user.id,
      role: "admin",
    });
    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Only event admin can record payments.",
      });
    }

    const member = await EventMember.findOne({ user: memberId, event: eventId });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this event.",
      });
    }

    // Don't allow paying more than what's owed
    const newTotal = member.amountPaid + amount;
    if (newTotal > member.amountToPay) {
      return res.status(400).json({
        success: false,
        message: `Payment exceeds amount owed. Remaining balance: ₹${(
          member.amountToPay - member.amountPaid
        ).toLocaleString()}.`,
      });
    }

    member.amountPaid = newTotal;
    await member.save(); // triggers the schema's pre("save") hook to recalculate paymentStatus

    // Notify the member their payment was recorded (only if they have an account)
    if (member.user) {
      await createNotification({
        recipient: member.user,
        sender: req.user.id,
        type: "donation_received", // reusing existing enum value — see note below
        title: "Payment Recorded",
        message: `A payment of ₹${amount.toLocaleString()} has been recorded for you.${
          member.paymentStatus === "paid" ? " You're fully paid up!" : ""
        }`,
        relatedEvent: eventId,
        link: `/events/${eventId}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully.",
      member,
    });
  } catch (error) {
    console.error("Record Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};