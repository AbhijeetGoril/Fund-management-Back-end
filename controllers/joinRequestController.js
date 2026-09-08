import JoinRequest from "../models/JoinRequest/joinRequestSchema.js";
import Society from "../models/Society/Society.js";
import Event from "../models/Event/Event.js";
import SocietyMember from "../models/Society/societyMemberSchema.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import User from "../models/User.js";
import { createNotification } from "../utils/createNotification.js";
import { isEventOrSocietyAdmin } from "./eventController.js";

// =====================================================
// POST /societies/:societyId/join-request
// =====================================================
export const requestToJoinSociety = async (req, res) => {
  try {
    const { societyId } = req.params;
    const { message = "" } = req.body || {};
    const userId = req.user.id;

    const society = await Society.findById(societyId);
    if (!society) {
      return res.status(404).json({ success: false, message: "Society not found." });
    }

    const alreadyMember = await SocietyMember.findOne({ society: societyId, user: userId });
    if (alreadyMember) {
      return res.status(409).json({ success: false, message: "You are already a member of this society." });
    }

    const existingPending = await JoinRequest.findOne({
      user: userId,
      society: societyId,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({ success: false, message: "Join request already pending." });
    }

    const requester = await User.findById(userId);

    const joinRequest = await JoinRequest.create({
      user: userId,
      type: "society",
      society: societyId,
      message: message.trim(),
    });

    const admins = await SocietyMember.find({ society: societyId, role: "admin", user: { $ne: null } });
    await Promise.all(
      admins.map((a) =>
        createNotification({
          recipient: a.user,
          sender: userId,
          type: "join_request_received",
          title: "New Join Request",
          message: `${requester.name} requested to join "${society.name}".`,
          relatedSociety: society._id,
          relatedJoinRequest: joinRequest._id,
          link: `/society/${society._id}/requests`,
        })
      )
    );

    return res.status(201).json({ success: true, message: "Join request sent.", joinRequest });
  } catch (error) {
    console.error("Request To Join Society Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// POST /events/:eventId/join-request
// =====================================================
export const requestToJoinEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { message = "" } = req.body || {};
    const userId = req.user.id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    if (event.society) {
      return res.status(400).json({
        success: false,
        message: "This event belongs to a society — join the society instead.",
      });
    }

    const alreadyMember = await EventMember.findOne({ event: eventId, user: userId });
    if (alreadyMember) {
      return res.status(409).json({ success: false, message: "You are already part of this event." });
    }

    const existingPending = await JoinRequest.findOne({
      user: userId,
      event: eventId,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({ success: false, message: "Join request already pending." });
    }

    const requester = await User.findById(userId);

    const joinRequest = await JoinRequest.create({
      user: userId,
      type: "event",
      event: eventId,
      message: message.trim(),
    });

    const admins = await EventMember.find({ event: eventId, role: "admin", user: { $ne: null } });
    await Promise.all(
      admins.map((a) =>
        createNotification({
          recipient: a.user,
          sender: userId,
          type: "join_request_received",
          title: "New Join Request",
          message: `${requester.name} requested to join "${event.title}".`,
          relatedEvent: event._id,
          relatedJoinRequest: joinRequest._id,
          link: `/events/${event._id}/requests`,
        })
      )
    );

    return res.status(201).json({ success: true, message: "Join request sent.", joinRequest });
  } catch (error) {
    console.error("Request To Join Event Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /societies/:societyId/join-requests  (admin only)
// =====================================================
export const getPendingJoinRequestsForSociety = async (req, res) => {
  try {
    const { societyId } = req.params;

    const admin = await SocietyMember.findOne({
      society: societyId,
      user: req.user.id,
      role: "admin",
    });
    if (!admin) {
      return res.status(403).json({ success: false, message: "Only society admin can view join requests." });
    }

    const requests = await JoinRequest.find({ society: societyId, type: "society", status: "pending" })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Get Pending Society Join Requests Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /events/:eventId/join-requests  (admin only)
// =====================================================
export const getPendingJoinRequestsForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const authorized = await isEventOrSocietyAdmin(event, req.user.id);
    if (!authorized) {
      return res.status(403).json({ success: false, message: "Only event or society admin can view join requests." });
    }

    const requests = await JoinRequest.find({ event: eventId, type: "event", status: "pending" })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Get Pending Event Join Requests Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// PATCH /join-requests/:id/approve
// =====================================================
export const approveJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const joinRequest = await JoinRequest.findById(id)
      .populate("user")
      .populate("society")
      .populate("event");

    if (!joinRequest) {
      return res.status(404).json({ success: false, message: "Join request not found." });
    }
    if (joinRequest.status !== "pending") {
      return res.status(409).json({ success: false, message: `Join request already ${joinRequest.status}.` });
    }

    let authorized = false;
    if (joinRequest.type === "society") {
      const admin = await SocietyMember.findOne({
        society: joinRequest.society._id,
        user: req.user.id,
        role: "admin",
      });
      authorized = !!admin;
    } else {
      authorized = await isEventOrSocietyAdmin(joinRequest.event, req.user.id);
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: "You are not authorized to approve this request." });
    }

    let newMember = null;

    if (joinRequest.type === "society") {
      const alreadyMember = await SocietyMember.findOne({
        society: joinRequest.society._id,
        user: joinRequest.user._id,
      });
      newMember =
        alreadyMember ||
        (await SocietyMember.create({
          society: joinRequest.society._id,
          user: joinRequest.user._id,
          name: joinRequest.user.name,
          email: joinRequest.user.email,
          role: "member",
          status: "active",
          addedBy: req.user.id,
          invitedBy: req.user.id,
        }));
    } else {
      const alreadyMember = await EventMember.findOne({
        event: joinRequest.event._id,
        user: joinRequest.user._id,
      });
      newMember =
        alreadyMember ||
        (await EventMember.create({
          event: joinRequest.event._id,
          user: joinRequest.user._id,
          name: joinRequest.user.name,
          email: joinRequest.user.email,
          role: "member",
          status: "active",
          addedBy: req.user.id,
          invitedBy: req.user.id,
        }));

      if (!alreadyMember) {
        await Event.findByIdAndUpdate(joinRequest.event._id, { $push: { members: newMember._id } });
      }
    }

    joinRequest.status = "approved";
    joinRequest.respondedBy = req.user.id;
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    await createNotification({
      recipient: joinRequest.user._id,
      sender: req.user.id,
      type: "join_request_approved",
      title: "Join Request Approved",
      message:
        joinRequest.type === "society"
          ? `Your request to join "${joinRequest.society.name}" was approved.`
          : `Your request to join "${joinRequest.event.title}" was approved.`,
      relatedSociety: joinRequest.society?._id || null,
      relatedEvent: joinRequest.event?._id || null,
      relatedJoinRequest: joinRequest._id,
      link:
        joinRequest.type === "society"
          ? `/society/${joinRequest.society._id}`
          : `/events/${joinRequest.event._id}`,
    });

    return res.status(200).json({ success: true, message: "Join request approved.", joinRequest, member: newMember });
  } catch (error) {
    console.error("Approve Join Request Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// PATCH /join-requests/:id/reject
// =====================================================
export const rejectJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const joinRequest = await JoinRequest.findById(id)
      .populate("user")
      .populate("society")
      .populate("event");

    if (!joinRequest) {
      return res.status(404).json({ success: false, message: "Join request not found." });
    }
    if (joinRequest.status !== "pending") {
      return res.status(409).json({ success: false, message: `Join request already ${joinRequest.status}.` });
    }

    let authorized = false;
    if (joinRequest.type === "society") {
      const admin = await SocietyMember.findOne({
        society: joinRequest.society._id,
        user: req.user.id,
        role: "admin",
      });
      authorized = !!admin;
    } else {
      authorized = await isEventOrSocietyAdmin(joinRequest.event, req.user.id);
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: "You are not authorized to reject this request." });
    }

    joinRequest.status = "rejected";
    joinRequest.respondedBy = req.user.id;
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    await createNotification({
      recipient: joinRequest.user._id,
      sender: req.user.id,
      type: "join_request_rejected",
      title: "Join Request Rejected",
      message:
        joinRequest.type === "society"
          ? `Your request to join "${joinRequest.society.name}" was rejected.`
          : `Your request to join "${joinRequest.event.title}" was rejected.`,
      relatedSociety: joinRequest.society?._id || null,
      relatedEvent: joinRequest.event?._id || null,
      relatedJoinRequest: joinRequest._id,
    });

    return res.status(200).json({ success: true, message: "Join request rejected.", joinRequest });
  } catch (error) {
    console.error("Reject Join Request Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};