import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import societyRoutes from "./routes/societyRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import aiRoutes from "./routes/aiRoutes.js"
import invitationRoute from "./routes/invitationRoute.js"
import eventRoute from "./routes/eventRoute.js";
import cookieParser from "cookie-parser";
import notificationRoutes from "./routes/notificationRoutes.js";
import spendRoutes from "./routes/spendRoutes.js";


dotenv.config();          // 1️⃣ Load env FIRST
connectDB();              // 2️⃣ Connect DB NEXT

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    credentials: true,               // allow cookies
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Society Fund Backend Running 🚀");
});

app.use("/api/users", userRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/invitations", invitationRoute);
app.use("/api/events", eventRoute);
app.use("/api/notification", notificationRoutes);
app.use("/api/spends", spendRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
