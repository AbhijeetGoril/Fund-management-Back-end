import express from "express"
import firebaseAuth from "../../middleware/firebaseAuth.js"
import { createSociety,createEvent } from "../../controllers/societyController.js"
const router=express.Router()
router.post("/createSociety",firebaseAuth,createSociety)
router.post("/createEvent",firebaseAuth,createEvent)
export default router