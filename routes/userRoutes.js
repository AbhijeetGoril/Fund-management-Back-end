import express from "express"
import { syncUser } from "../controllers/userController.js"
import firebaseAuth from "../middleware/firebaseAuth.js"
const router =express.Router()
router.post("/sync",firebaseAuth,syncUser)
export default router