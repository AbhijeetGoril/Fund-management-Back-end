import Conversation from "../models/Chat/conversationSchema.js";
import Message from "../models/Chat/messageSchema.js";
import SocietyMember from "../models/Society/societyMemberSchema.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import User from "../models/User.js";

// =====================================================
// GET /chat/conversations
// Every conversation (direct + group) this user is part of,
// sorted by most recent activity.
// =====================================================
export const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate("participants", "name email profilePicture")
      .populate("society", "name logo")
      .populate("event", "title coverPhoto")
      .sort({ "lastMessage.sentAt": -1, updatedAt: -1 });

    return res.status(200).json({ success: true, conversations });
  } catch (error) {
    console.error("Get My Conversations Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /chat/conversations/:id/messages
// Paginated message history for one conversation.
// =====================================================
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { before, limit = 50 } = req.query;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user.id
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not a participant in this conversation." });
    }

    const query = { conversation: id };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .populate("sender", "name email profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Mark everything in this batch as read by the requester
    await Message.updateMany(
      { conversation: id, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );

    return res.status(200).json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error("Get Messages Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// POST /chat/direct/:userId
// Get-or-create a direct conversation with another user.
// =====================================================
export const getOrCreateDirectConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: "Cannot message yourself." });
    }

    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let conversation = await Conversation.findOne({
      type: "direct",
      participants: { $all: [req.user.id, userId], $size: 2 },
    })
      .populate("participants", "name email profilePicture");

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [req.user.id, userId],
      });
      conversation = await conversation.populate("participants", "name email profilePicture");
    }

    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("Get Or Create Direct Conversation Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /chat/society/:societyId
// Get-or-create the group conversation for a society.
// Auto-syncs participants to current SocietyMember list.
// =====================================================
export const getOrCreateSocietyConversation = async (req, res) => {
  try {
    const { societyId } = req.params;

    const membership = await SocietyMember.findOne({
      society: societyId,
      user: req.user.id,
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: "You are not a member of this society." });
    }

    const members = await SocietyMember.find({ society: societyId, user: { $ne: null } }).select("user");
    const participantIds = members.map((m) => m.user);

    let conversation = await Conversation.findOne({ type: "group", society: societyId });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "group",
        society: societyId,
        participants: participantIds,
      });
    } else {
      // Keep participants in sync with current membership on every open —
      // cheap since it's just an array overwrite, and guarantees newly
      // added members can see/send in the group chat immediately.
      conversation.participants = participantIds;
      await conversation.save();
    }

    conversation = await conversation.populate("participants", "name email profilePicture");

    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("Get Or Create Society Conversation Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// GET /chat/event/:eventId
// Get-or-create the group conversation for a standalone event.
// =====================================================
export const getOrCreateEventConversation = async (req, res) => {
  try {
    const { eventId } = req.params;

    const membership = await EventMember.findOne({
      event: eventId,
      user: req.user.id,
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: "You are not a member of this event." });
    }

    const members = await EventMember.find({ event: eventId, user: { $ne: null } }).select("user");
    const participantIds = members.map((m) => m.user);

    let conversation = await Conversation.findOne({ type: "group", event: eventId });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "group",
        event: eventId,
        participants: participantIds,
      });
    } else {
      conversation.participants = participantIds;
      await conversation.save();
    }

    conversation = await conversation.populate("participants", "name email profilePicture");

    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("Get Or Create Event Conversation Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
