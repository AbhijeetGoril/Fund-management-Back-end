import express from "express"
import {acceptInvitation, inviteUser, rejectInvitation,cancelInvitation} from "../controllers/invitationController.js"
import { authMiddleware } from "../middleware/authMiddleware.js";
const router=express.Router();
router.post("/invite", authMiddleware, inviteUser);
router.patch("/:id/accept", authMiddleware, acceptInvitation);
router.patch("/:id/reject", authMiddleware, rejectInvitation);
router.patch("/:id/cancel", authMiddleware, cancelInvitation );
export default router;