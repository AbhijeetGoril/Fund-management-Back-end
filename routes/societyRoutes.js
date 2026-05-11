import express from "express"
import firebaseAuth from "../middleware/firebaseAuth.js"
import { createSociety,createEvent, getAllMyRelatedEvents, addParticipant, getSingleEvent } from "../controllers/societyController.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
const router=express.Router()
router.post("/createSociety",authMiddleware,createSociety)
router.get("/events/allMyRelatedEvents",authMiddleware,getAllMyRelatedEvents)
router.post("/events/createEvent",authMiddleware,createEvent)
router.post("/events/addParticipant",authMiddleware,addParticipant)
router.get(
  "/events/:eventId",
  authMiddleware,
  getSingleEvent
);
export default router