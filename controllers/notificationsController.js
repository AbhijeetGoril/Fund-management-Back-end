import notificationSchema from "../models/Notification/notificationSchema.js";
import User from "../models/User.js";
// =====================================================
// GET /api/notification
// Returns ALL notifications for the logged-in user.
// Frontend filters read/unread and type locally.
// =====================================================
export const getNotifications = async (req, res) => {
  try {
    // Step 1: find the logged-in user
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Step 2: grab their email
    const userEmail = currentUser.email;

    // Step 3: use it — e.g. search notifications belonging to them
    const notifications = await notificationSchema
      .find({ recipient: currentUser._id })
      .populate("sender", "name email")
      .populate("relatedEvent", "title")
      .populate("relatedSociety", "name")
      .populate("relatedInvitation", "status")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      email: userEmail,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// PATCH /api/notification/:id/read
// Mark ONE notification as read
// =====================================================
export const markAsRead = async (req, res) => {
  try {
    const notification = await notificationSchema.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id, // ownership check — can't mark someone else's notification as read
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    console.error("Mark As Read Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const markAllAsRead = async (req, res) => {
  try {
    await notificationSchema.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Mark All As Read Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};