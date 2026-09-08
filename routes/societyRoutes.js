import express from "express";
import firebaseAuth from "../middleware/firebaseAuth.js";
import {
  createSociety,
  createEvent,
  getAllMyRelatedEvents,
  getSingleEvent,
  getAllMySocieties,
  addSocietyMember,
  getSocietyDetail, // ADDED — this was missing
} from "../controllers/societyController.js";
import { getDiscoverSocieties } from "../controllers/discoverController.js";
import {
  requestToJoinSociety,
  getPendingJoinRequestsForSociety,
} from "../controllers/joinRequestController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Specific routes FIRST
router.post("/createSociety", authMiddleware, upload.single("logo"), createSociety);
router.get("/allMySocieties", authMiddleware, getAllMySocieties);
router.post("/addMember", authMiddleware, addSocietyMember);
router.get("/events/allMyRelatedEvents", authMiddleware, getAllMyRelatedEvents);
router.post("/events/createEvent", authMiddleware, upload.single("coverPhoto"), createEvent);
router.get("/events/:eventId", authMiddleware, getSingleEvent);

// Discover — must stay above the "/:societyId" catch-all below, or
// "discover" gets swallowed as a societyId value.
router.get("/discover", authMiddleware, getDiscoverSocieties);

// Join requests — two-segment paths, safe regardless of catch-all order
router.post("/:societyId/join-request", authMiddleware, requestToJoinSociety);
router.get("/:societyId/join-requests", authMiddleware, getPendingJoinRequestsForSociety);

// Generic catch-all LAST — must come after every specific route above,
// or it will incorrectly intercept requests meant for those routes
// (e.g. "/allMySocieties" being treated as a societyId).
router.get("/:societyId", authMiddleware, getSocietyDetail);

export default router;