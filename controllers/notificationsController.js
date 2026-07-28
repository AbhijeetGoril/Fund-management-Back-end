import notificationSchema from "../models/Notification/notificationSchema.js";

export const getNotifications = async (req, res) => {
  try {
    const { unreadOnly } = req.query;

    const filter = { recipient: req.user.id };
    if (unreadOnly === "true") filter.isRead = false;

    const notifications = await notificationSchema.find(filter)
      .populate("sender", "name email")
      .populate("relatedEvent", "title")
      .populate("relatedSociety", "name")
      .populate("relatedInvitation", "status") 
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
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