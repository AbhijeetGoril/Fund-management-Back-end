import express from "express"
import {acceptInvitation, inviteUser, rejectInvitation, cancelInvitation, getPendingInvitationsForEvent, getSentInvitations} from "../controllers/invitationController.js"
import { authMiddleware } from "../middleware/authMiddleware.js";
const router=express.Router();
router.post("/invite", authMiddleware, inviteUser);
router.get("/sent", authMiddleware, getSentInvitations);
router.get("/event/:eventId/pending", authMiddleware, getPendingInvitationsForEvent);
router.patch("/:id/accept", authMiddleware, acceptInvitation);
router.patch("/:id/reject", authMiddleware, rejectInvitation);
router.patch("/:id/cancel", authMiddleware, cancelInvitation );
export default router;