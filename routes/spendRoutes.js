import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import {
  addSpend,
  getEventSpends,
  updateSpend,
  deleteSpend,
} from "../controllers/spendController.js";

const router = express.Router();

router.post("/addSpend", authMiddleware, upload.single("receiptImage"), addSpend);
router.get("/event/:eventId", authMiddleware, getEventSpends);
router.put("/:spendId", authMiddleware, upload.single("receiptImage"), updateSpend);
router.delete("/:spendId", authMiddleware, deleteSpend);

export default router;