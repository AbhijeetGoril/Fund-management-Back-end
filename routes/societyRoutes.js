import express from "express"
import firebaseAuth from "../middleware/firebaseAuth.js"
import { createSociety,createEvent, getAllMyRelatedEvents, addParticipant } from "../controllers/societyController.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
const router=express.Router()
router.post("/createSociety",authMiddleware,createSociety)
router.get("/allMyRelatedEvents",authMiddleware,getAllMyRelatedEvents)
router.post("/createEvent",authMiddleware,createEvent)
router.post("/addParticipant",authMiddleware,addParticipant)
export default router