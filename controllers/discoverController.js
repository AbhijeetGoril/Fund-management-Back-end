import Society from "../models/Society/Society.js";
import Event from "../models/Event/Event.js";
import SocietyMember from "../models/Society/societyMemberSchema.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Invitation from "../models/Invitation/invitationSchema.js";
import JoinRequest from "../models/JoinRequest/joinRequestSchema.js";
import User from "../models/User.js";

// =====================================================
// GET /societies/discover
// Societies the user is NOT a member/admin of, hasn't been invited
// to (that's a separate flow/page), with pending self-initiated
// join requests flagged rather than hidden.
// =====================================================
export const getDiscoverSocieties = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    const myMemberships = await SocietyMember.find({ user: userId }).select("society");
    const myMemberSocietyIds = myMemberships.map((m) => m.society);

    const pendingInvitations = await Invitation.find({
      type: "society",
      status: "pending",
      $or: [{ user: userId }, { email: user.email.toLowerCase() }],
    }).select("society");
    const invitedSocietyIds = pendingInvitations.map((i) => i.society).filter(Boolean);

    const myJoinRequests = await JoinRequest.find({
      user: userId,
      type: "society",
      status: "pending",
    }).select("society");
    const requestMap = new Map(myJoinRequests.map((r) => [r.society.toString(), r._id]));

    const excludedIds = [...myMemberSocietyIds, ...invitedSocietyIds];

    const societies = await Society.find({ _id: { $nin: excludedIds } })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const enriched = societies.map((s) => ({
      ...s,
      hasPendingRequest: requestMap.has(s._id.toString()),
      joinRequestId: requestMap.get(s._id.toString()) || null,
    }));

    return res.status(200).json({ success: true, total: enriched.length, societies: enriched });
  } catch (error) {
    console.error("Get Discover Societies Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDiscoverEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    const myMemberships = await EventMember.find({ user: userId }).select("event");
    const myMemberEventIds = myMemberships.map((m) => m.event);

    const pendingInvitations = await Invitation.find({
      type: "event",
      status: "pending",
      $or: [{ user: userId }, { email: user.email.toLowerCase() }],
    }).select("event");
    const invitedEventIds = pendingInvitations.map((i) => i.event).filter(Boolean);

    const myJoinRequests = await JoinRequest.find({
      user: userId,
      type: "event",
      status: "pending",
    }).select("event");
    const requestMap = new Map(myJoinRequests.map((r) => [r.event.toString(), r._id]));

    const excludedIds = [...myMemberEventIds, ...invitedEventIds];

    const events = await Event.find({
      society: null,
      _id: { $nin: excludedIds },
      createdBy: { $ne: userId },
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const enriched = events.map((e) => ({
      ...e,
      hasPendingRequest: requestMap.has(e._id.toString()),
      joinRequestId: requestMap.get(e._id.toString()) || null,
    }));

    return res.status(200).json({ success: true, total: enriched.length, events: enriched });
  } catch (error) {
    console.error("Get Discover Events Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};