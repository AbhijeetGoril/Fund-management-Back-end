import express from "express"
import { createUser, syncUser } from "../controllers/userController.js"
import firebaseAuth from "../middleware/firebaseAuth.js"
const router =express.Router()
router.post("/sync",firebaseAuth,syncUser)
router.post("/signup",createUser)
export default router