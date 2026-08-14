import express from "express"
import firebaseAuth from "../middleware/firebaseAuth.js"
import { createSociety,createEvent, getAllMyRelatedEvents, getSingleEvent,getAllMySocieties } from "../controllers/societyController.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
import upload from "../middleware/upload.js"
const router=express.Router()
router.post(
  "/createSociety",
  authMiddleware,
  upload.single("logo"),
  createSociety
);
router.get("/events/allMyRelatedEvents",authMiddleware,getAllMyRelatedEvents)
router.post("/events/createEvent",authMiddleware,upload.single("coverPhoto"),createEvent)

router.get(
  "/events/:eventId",
  authMiddleware,
  getSingleEvent
);
router.get("/allMySocieties", authMiddleware, getAllMySocieties);
export default router