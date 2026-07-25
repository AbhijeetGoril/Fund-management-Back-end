import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // User receiving the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // User who triggered the notification
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        "invitation_received",
        "invitation_accepted",
        "invitation_rejected",
        "participant_added",
        "event_created",
        "event_updated",
        "event_reminder",
        "donation_received",
        "expense_added",
      ],
      required: true,
    },

    // Heading
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Body
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Related resources
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    relatedSociety: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      default: null,
    },

    relatedInvitation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invitation",
      default: null,
    },

    // Frontend redirect URL
    link: {
      type: String,
      default: null,
    },

    // Has the user opened this notification?
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Optional icon
    icon: {
      type: String,
      default: null,
    },

    // Optional priority
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

// Fetch notifications quickly
notificationSchema.index({
  recipient: 1,
  isRead: 1,
  createdAt: -1,
});

export default mongoose.model("Notification", notificationSchema);