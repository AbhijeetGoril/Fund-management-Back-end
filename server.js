import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import societyRoutes from "./routes/societyRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import invitationRoute from "./routes/invitationRoute.js";
import eventRoute from "./routes/eventRoute.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import spendRoutes from "./routes/spendRoutes.js";
import joinRequestRoutes from "./routes/joinRequestRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import homeRoute from "./routes/homeRoute.js";

import { startPaymentReminderCron } from "./services/Paymentremindercron.js";
import { initSocketServer } from "./services/socketServer.js";

dotenv.config();

connectDB();

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ============================================
// ROOT
// ============================================

app.get("/", (req, res) => {
  res.send("Society Fund Backend Running 🚀");
});

// ============================================
// API ROUTES
// ============================================

app.use("/api/users", userRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/invitations", invitationRoute);
app.use("/api/events", eventRoute);
app.use("/api/notification", notificationRoutes);
app.use("/api/spends", spendRoutes);
app.use("/api/join-requests", joinRequestRoutes);
app.use("/api/chat", chatRoutes);

// Home page statistics
app.use("/api/home", homeRoute);

// ============================================
// HTTP + SOCKET SERVER
// ============================================

const httpServer = http.createServer(app);

initSocketServer(httpServer);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPaymentReminderCron();
});