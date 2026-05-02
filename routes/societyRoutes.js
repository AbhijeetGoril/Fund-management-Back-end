import express from "express"
import firebaseAuth from "../middleware/firebaseAuth.js"
import { createSociety,createEvent } from "../controllers/societyController.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
const router=express.Router()
router.post("/createSociety",authMiddleware,createSociety)
router.post("/createEvent",authMiddleware,createEvent)
export default router