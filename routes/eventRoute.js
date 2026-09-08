import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addParticipant, updateMember, getMemberDetails, getAdminOverview } from "../controllers/eventController.js";
import { recordPayment } from "../controllers/paymentController.js";
import { getDiscoverEvents } from "../controllers/discoverController.js";
import {
  requestToJoinEvent,
  getPendingJoinRequestsForEvent,
} from "../controllers/joinRequestController.js";
import upload from "../middleware/upload.js";



const router = express.Router();

// Discover — events the user is not part of in any way (society-attached
// events excluded entirely). Placed above any single-param routes so
// "discover" is never swallowed as an :eventId value.
router.get("/discover", authMiddleware, getDiscoverEvents);

// Join requests
router.post("/:eventId/join-request", authMiddleware, requestToJoinEvent);
router.get("/:eventId/join-requests", authMiddleware, getPendingJoinRequestsForEvent);

// Add Participant update this also
router.post("/addParticipant", authMiddleware, addParticipant);
router.patch(
  "/:eventId/members/:memberId/payment",
  authMiddleware,
  upload.single("receiptImage"),  // <-- add this
  recordPayment
);
router.patch("/:eventId/members/:memberId", authMiddleware, updateMember);

// NOTE: this GET route must come AFTER the two PATCH routes above are
// registered — but since Express matches routes by method AND path
// together, a GET here won't collide with the PATCH routes on the same
// path pattern. Still placing it last for consistency with your
// documented convention of specific routes before generic ones.
router.get("/:eventId/members/:memberId", authMiddleware, getMemberDetails);
router.get("/admin-overview",authMiddleware,getAdminOverview)
export default router;