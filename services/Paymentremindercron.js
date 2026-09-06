import cron from "node-cron";
import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import { createNotification } from "../utils/createNotification.js";

const REMINDER_DAYS_BEFORE = 5; // start reminding once due date is this many days away or closer
const MIN_HOURS_BETWEEN_REMINDERS = 20; // avoid double-sending if the job runs more than once

const shouldRemind = (member) => {
  if (!member.dueDate) return false;
  if (member.paymentStatus === "paid") return false;

  const due = new Date(member.dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays > REMINDER_DAYS_BEFORE) return false; // still more than 5 days away, skip

  if (member.lastReminderSentAt) {
    const hoursSinceLastReminder =
      (Date.now() - new Date(member.lastReminderSentAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastReminder < MIN_HOURS_BETWEEN_REMINDERS) return false; // already reminded recently
  }

  return true;
};

/**
 * Finds every EventMember whose due date is approaching or has passed,
 * and who hasn't already paid in full, then sends them (and the other
 * event admins) a reminder — the same notification content as the
 * manual "Remind" button, just triggered automatically on a schedule
 * instead of by an admin clicking.
 */
export const runDailyPaymentReminders = async () => {
  console.log("[payment-reminders] Starting daily reminder run...");

  const candidates = await EventMember.find({
    dueDate: { $ne: null },
    paymentStatus: { $ne: "paid" },
  }).populate("event", "title");

  let remindersSent = 0;

  for (const member of candidates) {
    if (!shouldRemind(member)) continue;
    if (!member.event) continue; // event may have been deleted

    const remaining = (member.amountToPay ?? 0) - (member.amountPaid ?? 0);
    if (remaining <= 0) continue;

    const due = new Date(member.dueDate);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays < 0;

    const dueDateText = due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    // Notify the member, if they have a linked account
    if (member.user) {
      await createNotification({
        recipient: member.user,
        sender: null, // system-generated, not sent by a specific admin
        type: "event_reminder",
        title: isOverdue ? "Payment Overdue" : "Payment Reminder",
        message: isOverdue
          ? `₹${remaining.toLocaleString()} was due on ${dueDateText} for "${member.event.title}" — please pay as soon as possible.`
          : `₹${remaining.toLocaleString()} is due by ${dueDateText} for "${member.event.title}".`,
        relatedEvent: member.event._id,
        link: `/events/${member.event._id}`,
      });

      remindersSent++;
    }

    member.lastReminderSentAt = new Date();
    await member.save();
  }

  console.log(`[payment-reminders] Done. Sent ${remindersSent} reminder(s).`);
};

/**
 * Registers the daily schedule. Call this once when the server starts
 * (e.g. from server.js) — it then runs automatically in the background.
 * Cron pattern "0 9 * * *" = every day at 9:00 AM server time.
 */
export const startPaymentReminderCron = () => {
  cron.schedule("53 14 * * *", () => {
    runDailyPaymentReminders().catch((err) => {
      console.error("[payment-reminders] Cron run failed:", err);
    });
  });

  console.log("[payment-reminders] Cron job scheduled for 9:00 AM daily.")
};