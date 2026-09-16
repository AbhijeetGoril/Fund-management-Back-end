import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketAuth.js";
import Message from "../models/Chat/messageSchema.js";
import Conversation from "../models/Chat/conversationSchema.js";

let io = null;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://fund-management-front-end.vercel.app",
      ],
      credentials: true,
    },
  });

  io.use(socketAuth);

  io.on("connection", (socket) => {
    // Every user joins a personal room keyed by their own id — this is
    // how we push new-message events to them regardless of which
    // conversation room(s) they currently have open in the UI.
    socket.join(`user:${socket.userId}`);

    // Join a specific conversation's room (client calls this when it
    // opens a chat thread) so typing indicators / instant delivery work
    // for anyone actively viewing that thread.
    socket.on("conversation:join", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("message:send", async ({ conversationId, text }, callback) => {
      try {
        if (!text?.trim()) {
          return callback?.({ success: false, message: "Message cannot be empty." });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback?.({ success: false, message: "Conversation not found." });
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === socket.userId
        );
        if (!isParticipant) {
          return callback?.({ success: false, message: "Not a participant in this conversation." });
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          text: text.trim(),
          readBy: [socket.userId],
        });

        conversation.lastMessage = {
          text: text.trim(),
          sender: socket.userId,
          sentAt: message.createdAt,
        };
        await conversation.save();

        const populated = await message.populate("sender", "name email profilePicture");

        // Deliver to everyone actively viewing this conversation
        io.to(`conversation:${conversationId}`).emit("message:new", populated);

        // Also notify every participant's personal room, so their
        // conversation list / unread badge updates even if they don't
        // have this specific thread open right now.
        conversation.participants.forEach((participantId) => {
          io.to(`user:${participantId.toString()}`).emit("conversation:updated", {
            conversationId,
            lastMessage: conversation.lastMessage,
          });
        });

        callback?.({ success: true, message: populated });
      } catch (error) {
        console.error("Socket message:send error:", error);
        callback?.({ success: false, message: error.message });
      }
    });

    socket.on("disconnect", () => {
      // no-op for now — room membership is cleaned up automatically
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized yet.");
  return io;
};