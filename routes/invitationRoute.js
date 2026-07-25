import express from "express"
import {acceptInvitation, inviteUser} from "../controllers/invitationController.js"
import { authMiddleware } from "../middleware/authMiddleware.js";
const router=express.Router();
router.post("/invite", authMiddleware, inviteUser);
router.post("/:id/accept", authMiddleware, acceptInvitation);
export default router;