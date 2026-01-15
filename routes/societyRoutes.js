import express from "express"
import firebaseAuth from "../middleware/firebaseAuth.js"
import { createSociety } from "../controllers/societyController.js"
const router=express.Router()
router.post("/createSociety",firebaseAuth,createSociety)
export default router