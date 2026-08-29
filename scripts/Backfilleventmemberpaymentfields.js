/**
 * Migration: backfill dueDate on existing EventMember docs, and create
 * opening-balance Payment records for members who already have
 * amountPaid > 0.
 *
 * Why this is needed:
 * dueDate is a newer field — Mongoose shows its default (null) in-memory
 * on read even for old documents, but raw queries/aggregations need it
 * to actually exist on the stored document.
 *
 * Separately: since payments are now tracked in their own Payment
 * collection (not an embedded array), any member who already has
 * amountPaid > 0 from before this feature existed has no corresponding
 * Payment documents yet. This creates ONE synthetic "opening balance"
 * Payment per such member so the audit trail isn't empty for money
 * that was already collected. We don't know the exact historical
 * date/recorder for each individual past payment, so this is a
 * best-effort approximation, clearly labeled as such:
 *   - paymentDate -> the member's existing `updatedAt` (closest proxy we
 *                     have to "when this amountPaid value was last set")
 *   - recordedBy  -> the member's `addedBy` (best available attribution)
 *   - note        -> "Opening balance (migrated)"
 *
 * Run with:  node scripts/migrations/backfillEventMemberPaymentFields.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import EventMember from "../models/Event/EventMemberSchema.js";
import Payment from "../models/Event/PaymentSchema.js";

dotenv.config({ path: "../.env" });

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // 1) Initialize dueDate on any doc where it's genuinely missing —
  //    default to 10 days from now.
  const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const dueDateResult = await EventMember.updateMany(
    { dueDate: { $exists: false } },
    { $set: { dueDate: tenDaysFromNow } }
  );
  console.log(`dueDate initialized on ${dueDateResult.modifiedCount} document(s)`);

  // 2) Find members with an existing balance but no Payment records yet.
  const membersWithBalance = await EventMember.find({ amountPaid: { $gt: 0 } });
  console.log(
    `Found ${membersWithBalance.length} member(s) with amountPaid > 0 to check`
  );

  let created = 0;
  for (const member of membersWithBalance) {
    const alreadyHasPayments = await Payment.exists({ eventMember: member._id });
    if (alreadyHasPayments) continue;

    await Payment.create({
      targetType: "event",
      eventMember: member._id,
      event: member.event,
      amount: member.amountPaid,
      paymentDate: member.updatedAt || member.joinedAt || member.createdAt,
      recordedBy: member.addedBy,
      method: "other",
      note: "Opening balance (migrated)",
    });

    created++;
    if (created % 50 === 0) {
      console.log(`  ...${created}/${membersWithBalance.length} backfilled`);
    }
  }

  console.log(`Created ${created} opening-balance Payment record(s)`);

  await mongoose.disconnect();
  console.log("Migration complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});