import express from "express"
import firebaseAuth from "../middleware/firebaseAuth.js"
import { createSociety,createEvent, getAllMyRelatedEvents, addParticipant, getSingleEvent, addSpend } from "../controllers/societyController.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
import upload from "../middleware/upload.js"
const router=express.Router()
router.post("/createSociety",authMiddleware,createSociety)
router.get("/events/allMyRelatedEvents",authMiddleware,getAllMyRelatedEvents)
router.post("/events/createEvent",authMiddleware,upload.single("coverPhoto"),createEvent)
router.post("/events/addParticipant",authMiddleware,addParticipant)
router.get(
  "/events/:eventId",
  authMiddleware,
  getSingleEvent
);

// Add Spend
router.post(
  "/events/spends/addSpend",
  authMiddleware,
  upload.single("receiptImage"),
  addSpend
);

export default router