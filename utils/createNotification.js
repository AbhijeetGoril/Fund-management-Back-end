// utils/createNotification.js

import Notification from "../models/Notification/notificationSchema.js";

export const createNotification = async ({
  recipient,
  sender,
  type,
  title,
  message,
  relatedEvent = null,
  relatedSociety = null,
  relatedInvitation = null,
  link = null,
}) => {
  return Notification.create({
    recipient,
    sender,
    type,
    title,
    message,
    relatedEvent,
    relatedSociety,
    relatedInvitation,
    link,
  });
};