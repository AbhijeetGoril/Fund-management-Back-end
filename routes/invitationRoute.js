import express from "express"
import {inviteUser} from "../controllers/invitationController.js"
import { authMiddleware } from "../middleware/authMiddleware.js";
const router=express.Router();
router.post("/invite", authMiddleware, inviteUser);
export default router;