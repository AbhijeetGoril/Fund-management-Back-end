import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import firebaseAuth from "./middleware/firebaseAuth.js";
import userRoutes from "./routes/userRoutes.js";
import societyRoutes from "./routes/societyRoutes.js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Society Fund Backend Running 🚀");
});



app.use("/api/users", userRoutes);
app.use("/api/societies", societyRoutes);
// 🔐 Protected route
app.get("/api/protected", firebaseAuth, (req, res) => {
  res.json({
    message: "User verified by Firebase ✅",
    uid: req.user.uid,
    email: req.user.email,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});
