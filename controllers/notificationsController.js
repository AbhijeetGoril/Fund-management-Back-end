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