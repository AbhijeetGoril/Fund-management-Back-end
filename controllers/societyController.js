import User from "../models/User.js";
import Society from "../models/Society/Society.js";
import Event from "../models/Event/Event.js";
import { generateEventCategory } from "../services/geminiService.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import Participant from "../models/Event/ParticipantSchema.js";
import cloudinary from "../config/cloudinary.js";
// controllers/spendController.js
import Spend from "../models/Event/SpendSchema.js";

import SocietyMember from "../models/Society/societyMemberSchema.js";

export const createSociety = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Society name is required",
      });
    }

    const dbUser = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!dbUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const existingSociety = await Society.findOne({
      name: name.trim(),
    });

    if (existingSociety) {
      return res.status(409).json({
        message: "Society name already exists",
      });
    }

    // Create society
    const society = await Society.create({
      name: name.trim(),
      createdBy: dbUser._id,
    });

    // Add creator as admin
    await SocietyMember.create({
      society: society._id,
      user: dbUser._id,
      role: "admin",
    });

    const populatedSociety = await Society.findById(society._id).populate(
      "createdBy",
      "name email",
    );

    res.status(201).json({
      message: "Society created successfully",
      society: populatedSociety,
    });
  } catch (error) {
    console.error("Create society error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Society name already exists",
      });
    }

    res.status(500).json({
      message: "Internal server error",
    });
  }
};
export const createEvent = async (req, res) => {
  try {
    const { title, date, description, societyId, location, budget } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    const dbUser = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!dbUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let society = null;

    if (societyId) {
      society = await Society.findById(societyId);

      if (!society) {
        return res.status(404).json({
          message: "Society not found",
        });
      }

      const isAdmin = society.members.some(
        (m) =>
          m.user.toString() === dbUser._id.toString() && m.role === "admin",
      );

      if (!isAdmin) {
        return res.status(403).json({
          message: "Admin access only",
        });
      }
    }

    let coverPhoto = "";
    if (req.file) {
      const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
        folder: "events",
      });
      coverPhoto = uploadedImage.secure_url;
    }

    // AI category + description
    const aiData = await generateEventCategory(title);

    const event = await Event.create({
      title: title.trim(),

      date: date || Date.now(),

      description: description || aiData.description,

      category: aiData.category,

      society: society ? society._id : null,

      createdBy: dbUser._id,

      // OPTIONAL LOCATION
      location: location || "",

      // OPTIONAL BUDGET
      budget: {
        target: budget || 0,
      },

      coverPhoto,
    });

    res.status(201).json(event);
  } catch (error) {
    console.log(error.message);

    res.status(500).json({
      message: error.message,
    });
  }
};
export const getAllMyRelatedEvents = async (req, res) => {
  try {
    const memberships = await EventMember.find({
      user: req.user.id,
    });
    const memberEventIds = memberships.map((member) => member.event.toString());
    const events = await Event.find({
      $or: [{ createdBy: req.user.id }, { _id: { $in: memberEventIds } }],
    })
      .populate("createdBy", "name email")
      .populate("society", "name")
      .populate({
        path: "members",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });
    const updatedEvent = events.map((event) => {
      const myMemberData = event.members.find(
        (member) => member.user && member.user._id.toString() === req.user.id,
      );
      return {
        ...event.toObject(),
        isAdmin: myMemberData?.role === "admin",
      };
    });
    res.status(200).json({
      success: true,
      total: updatedEvent.length,
      events: updatedEvent,
    });
  } catch (error) {
    console.log(error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



export const getSingleEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    // -----------------------------
    // CHECK EVENT EXISTS
    // -----------------------------
    const event = await Event.findById(eventId)
      .populate("createdBy", "name email")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // -----------------------------
    // GET ALL EVENT MEMBERS (no status filter — full history included)
    // -----------------------------
    const members = await EventMember.find({
      event: eventId,
    })
      .populate("user", "name email")
      .lean();

    // "Participants" for financial totals = anyone with a payment
    // obligation, regardless of role — an admin can also owe money.
    const payingMembers = members.filter((m) => m.amountToPay > 0);

    // "Participants" for the members-list display = role-based
    const participantsByRole = members.filter((m) => m.role === "participant");

    const totalAmountToPay = payingMembers.reduce(
      (sum, m) => sum + (m.amountToPay || 0),
      0
    );
    const totalAmountPaid = payingMembers.reduce(
      (sum, m) => sum + (m.amountPaid || 0),
      0
    );
    const totalPendingAmount = totalAmountToPay - totalAmountPaid;

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: true,
      event,
      members,
      participants: participantsByRole,
      summary: {
        totalMembers: members.length,
        totalParticipants: participantsByRole.length,
        totalPayingMembers: payingMembers.length,
        totalAmountToPay,
        totalAmountPaid,
        totalPendingAmount,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// export const addSpend = async (req, res) => {
//   try {
//     const {
//       event,
//       title,
//       amount,
//       category,
//       paidBy,
//       paidTo,
//       notes,
//       spendDate,
//       receiptNumber,
//     } = req.body;
//     if (!event || !title || !amount || !paidBy) {
//       return res.status(400).json({
//         success: false,
//         message: "Event, title, amount and paidBy are required",
//       });
//     }
//     const dbUser = await User.findById(req.user.id);

//     if (!dbUser) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }
//     // Find event
//     const existingEvent = await Event.findById(event);
//     if (!existingEvent) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found",
//       });
//     }

//     // =================================
//     // Permission Check
//     // =================================

//     if (existingEvent.society) {
//       const societyAdmin = await SocietyMember.findOne({
//         society: existingEvent.society,
//         user: dbUser._id,
//         role: "admin",
//       });
//       if (!societyAdmin) {
//         return res.status(403).json({
//           success: false,
//           message: "Only society admins can add spends",
//         });
//       }
//     } else {
//       // Individual Event
//       console.log("eventId:", existingEvent._id)
//       console.log("user:",dbUser._id)
//       const eventAdmin = await EventMember.findOne({
//         event: existingEvent._id,
//         user: dbUser._id,
//         role: "admin",
//       });

//       if (!eventAdmin) {
//         return res.status(403).json({
//           success: false,
//           message: "Only event admins can add spends",
//         });
//       }
//     }
//     let receiptImage = "";
//     if (req.file) {
//       const uploadedImage =await cloudinary.uploader.upload(req.file.path, {
//         folder: "spends",
//       });
//       receiptImage =
//         uploadedImage.secure_url;
//     }
//     // =================================
//     // Create Spend
//     // =================================

//     const spend = await Spend.create({
//       event,
//       title: title.trim(),
//       amount:Number(amount),
//       category: category || "Other",
//       paidBy,
//       paidTo: paidTo || "",
//       notes: notes || "",
//       spendDate: spendDate || Date.now(),
//       receiptNumber: receiptNumber || "",
//       receiptImage,
//       createdBy: dbUser._id,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Spend added successfully",
//       data: spend,
//     });
//   } catch (error) {
//     console.error("Add Spend Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to add spend",
//       error: error.message,
//     });
//   }
// };


// // Add this to your controller file

// export const getEventSpends = async (req, res) => {
//   try {
//     const { eventId } = req.params;

//     const existingEvent = await Event.findById(eventId).lean();
//     if (!existingEvent) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found",
//       });
//     }

//     const spends = await Spend.find({ event: eventId })
//       .populate("paidBy", "name email")
//       .populate("createdBy", "name email")
//       .populate("approvedBy", "name email")
//       .sort({ spendDate: -1 });

//     const totalSpent = spends.reduce((sum, s) => sum + s.amount, 0);

//     return res.status(200).json({
//       success: true,
//       data: {
//         event: existingEvent,
//         spends,
//         summary: {
//           totalSpent,
//           totalCount:    spends.length,
//           pendingCount:  spends.filter((s) => s.status === "pending").length,
//           approvedCount: spends.filter((s) => s.status === "approved").length,
//           rejectedCount: spends.filter((s) => s.status === "rejected").length,
//           remainingBudget: (existingEvent.budget?.target || 0) - totalSpent,
//           totalBudget: existingEvent.budget?.target || 0,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Get Event Spends Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch spends",
//       error: error.message,
//     });
//   }
// };
// // Add these to your controller file

// export const updateSpend = async (req, res) => {
//   try {
//     const { spendId } = req.params;
//     const {
//       title,
//       amount,
//       category,
//       paidBy,
//       paidTo,
//       notes,
//       spendDate,
//       receiptNumber,
//     } = req.body;

//     const dbUser = await User.findById(req.user.id);
//     if (!dbUser) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     const spend = await Spend.findById(spendId);
//     if (!spend) {
//       return res.status(404).json({ success: false, message: "Spend not found" });
//     }

//     // ── Permission Check ──────────────────────────────────────
//     const existingEvent = await Event.findById(spend.event);

//     if (existingEvent.society) {
//       const societyAdmin = await SocietyMember.findOne({
//         society: existingEvent.society,
//         user: dbUser._id,
//         role: "admin",
//       });
//       if (!societyAdmin) {
//         return res.status(403).json({
//           success: false,
//           message: "Only society admins can update spends",
//         });
//       }
//     } else {
//       const eventAdmin = await EventMember.findOne({
//         event: existingEvent._id,
//         user: dbUser._id,
//         role: "admin",
//       });
//       if (!eventAdmin) {
//         return res.status(403).json({
//           success: false,
//           message: "Only event admins can update spends",
//         });
//       }
//     }

//     // ── Upload new receipt image if provided ──────────────────
//     let receiptImage = spend.receiptImage; // keep existing
//     if (req.file) {
//       const uploaded = await cloudinary.uploader.upload(req.file.path, {
//         folder: "spends",
//       });
//       receiptImage = uploaded.secure_url;
//     }

//     // ── Update fields ─────────────────────────────────────────
//     if (title)         spend.title         = title.trim();
//     if (amount)        spend.amount        = Number(amount);
//     if (category)      spend.category      = category;
//     if (paidBy)        spend.paidBy        = paidBy;
//     if (paidTo  !== undefined) spend.paidTo        = paidTo;
//     if (notes   !== undefined) spend.notes         = notes;
//     if (spendDate)     spend.spendDate     = spendDate;
//     if (receiptNumber !== undefined) spend.receiptNumber = receiptNumber;
//     spend.receiptImage = receiptImage;

//     await spend.save();

//     const updated = await Spend.findById(spendId)
//       .populate("paidBy", "name email")
//       .populate("createdBy", "name email");

//     return res.status(200).json({
//       success: true,
//       message: "Spend updated successfully",
//       data: updated,
//     });
//   } catch (error) {
//     console.error("Update Spend Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update spend",
//       error: error.message,
//     });
//   }
// };

// export const deleteSpend = async (req, res) => {
//   try {
//     const { spendId } = req.params;

//     const dbUser = await User.findById(req.user.id);
//     if (!dbUser) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     const spend = await Spend.findById(spendId);
//     if (!spend) {
//       return res.status(404).json({ success: false, message: "Spend not found" });
//     }

//     // ── Permission Check ──────────────────────────────────────
//     const existingEvent = await Event.findById(spend.event);

//     if (existingEvent.society) {
//       const societyAdmin = await SocietyMember.findOne({
//         society: existingEvent.society,
//         user: dbUser._id,
//         role: "admin",
//       });
//       if (!societyAdmin) {
//         return res.status(403).json({
//           success: false,
//           message: "Only society admins can delete spends",
//         });
//       }
//     } else {
//       const eventAdmin = await EventMember.findOne({
//         event: existingEvent._id,
//         user: dbUser._id,
//         role: "admin",
//       });
//       if (!eventAdmin) {
//         return res.status(403).json({
//           success: false,
//           message: "Only event admins can delete spends",
//         });
//       }
//     }

//     // ── Delete receipt image from cloudinary if exists ────────
//     if (spend.receiptImage) {
//       const publicId = spend.receiptImage
//         .split("/")
//         .slice(-2)
//         .join("/")
//         .split(".")[0]; // extracts "spends/filename"
//       await cloudinary.uploader.destroy(publicId);
//     }

//     await Spend.findByIdAndDelete(spendId);

//     return res.status(200).json({
//       success: true,
//       message: "Spend deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete Spend Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete spend",
//       error: error.message,
//     });
//   }
// };