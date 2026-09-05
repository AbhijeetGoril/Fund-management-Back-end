import EventMember from "../models/Event/EventMemberSchema.js";
import { createNotification } from "../utils/createNotification.js";
import Payment from "../models/Event/PaymentSchema.js"; // match your actual path
import cloudinary from "../config/cloudinary.js";
// =====================================================
// PATCH /api/events/:eventId/members/:memberId/payment
// Admin records a payment against a member's balance.
// Body: { amountPaid } -- the amount to ADD to what they've already paid
// =====================================================
export const recordPayment = async (req, res) => {
  try {
    const { eventId, memberId } = req.params;
    const { amountPaid } = req.body || {};

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

    // FIX: look up by the EventMember document's own _id, not by the
    // `user` field. Offline members have user: null, so querying by
    // `user: memberId` could never match them — this is exactly why
    // offline payment recording was silently failing with
    // "Member not found in this event."
    const member = await EventMember.findOne({ _id: memberId, event: eventId });
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

    // Optional receipt image, uploaded the same way createEvent handles
    // coverPhoto — requires the route to use multer (e.g. upload.single("receiptImage"))
    let receiptImage = "";
    if (req.file) {
      const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
        folder: "payment_receipts",
      });
      receiptImage = uploadedImage.secure_url;
    }

    // Create the actual Payment record — this is what keeps the audit
    // trail (sum of all Payment records for this member) in sync with
    // EventMember.amountPaid. type: "payment" marks this as a real,
    // positive payment (as opposed to type: "correction" used in
    // updateMember for direct amountPaid edits).
    await Payment.create({
      targetType: "event",
      type: "payment",
      eventMember: member._id,
      event: member.event,
      amount,
      recordedBy: req.user.id,
      method: req.body.method || "other",
      note: req.body.note || "",
      receiptImage,
    });

    // Notify the member whose payment was recorded (only if they have an account)
    if (member.user) {
      await createNotification({
        recipient: member.user,
        sender: req.user.id,
        type: "donation_received",
        title: "Payment Recorded",
        message: `A payment of ₹${amount.toLocaleString()} has been recorded for you.${
          member.paymentStatus === "paid" ? " You're fully paid up!" : ""
        }`,
        relatedEvent: eventId,
        link: `/events/${eventId}`,
      });
    }

    // Notify EVERYONE ELSE in the event (including the acting admin,
    // if they're not the payer) that a payment came in — only the
    // payer is excluded, since they already got their own notification.
    const payerName = member.name;
    const otherMembers = await EventMember.find({
      event: eventId,
      user: { $ne: null }, // only members with real accounts
    });

    await Promise.all(
      otherMembers
        .filter((m) => {
          const isThePayerThemself = member.user && m.user.toString() === member.user.toString();
          return !isThePayerThemself;
        })
        .map((m) =>
          createNotification({
            recipient: m.user,
            sender: req.user.id,
            type: "donation_received",
            title: "Payment Received",
            message: `${payerName} paid ₹${amount.toLocaleString()} towards the event fund.`,
            relatedEvent: eventId,
            link: `/events/${eventId}`,
          })
        )
    );

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