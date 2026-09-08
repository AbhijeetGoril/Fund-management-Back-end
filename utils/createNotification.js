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
  relatedJoinRequest = null,
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
    relatedJoinRequest,
    link,
  });
};