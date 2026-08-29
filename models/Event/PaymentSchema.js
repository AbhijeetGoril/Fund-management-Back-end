import mongoose from "mongoose";

/**
 * Payment — the "money in" counterpart to your existing Spend model
 * ("money out"). Kept as its own top-level collection rather than
 * embedded on EventMember/SocietyMember, mirroring how Spend is a
 * standalone collection rather than embedded on Event.
 *
 * Generalized to cover BOTH contexts this app tracks money for:
 *   - targetType "event"   -> payment is for an EventMember
 *   - targetType "society" -> payment is for a SocietyMember
 *
 * Exactly one of eventMember / societyMember will be set, matching
 * targetType. Kept as two separate optional refs (rather than one
 * polymorphic ref) so .populate("eventMember") / .populate("societyMember")
 * work normally without refPath complexity.
 */
const paymentSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["event", "society"],
      required: true,
    },

    // Set when targetType === "event"
    eventMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventMember",
      default: null,
    },

    // Denormalized for fast "all payments for this event" queries
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    // Set when targetType === "society"
    societyMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocietyMember",
      default: null,
    },

    // Denormalized for fast "all payments for this society" queries
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // When the payment actually happened (may differ slightly from
    // createdAt if an admin is recording a payment after the fact)
    paymentDate: {
      type: Date,
      default: Date.now,
    },

    // Who recorded this payment (an admin) — not necessarily the payer
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    method: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "card", "other"],
      default: "other",
    },

    note: {
      type: String,
      default: "",
    },

    // Optional receipt/proof of payment, mirroring Spend.receiptImage
    receiptImage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Guard: exactly one target ref must be set, matching targetType.
paymentSchema.pre("validate", async function () {
  if (this.targetType === "event") {
    if (!this.eventMember) {
      throw new Error("eventMember is required when targetType is 'event'.");
    }
    this.societyMember = null;
  } else if (this.targetType === "society") {
    if (!this.societyMember) {
      throw new Error("societyMember is required when targetType is 'society'.");
    }
    this.eventMember = null;
  }
});

// Fast lookups, most recent first.
paymentSchema.index({ eventMember: 1, paymentDate: -1 });
paymentSchema.index({ event: 1, paymentDate: -1 });
paymentSchema.index({ societyMember: 1, paymentDate: -1 });
paymentSchema.index({ society: 1, paymentDate: -1 });

export default mongoose.model("Payment", paymentSchema);