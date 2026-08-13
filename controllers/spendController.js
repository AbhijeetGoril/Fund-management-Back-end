import User from "../models/User.js";
import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";
import SocietyMember from "../models/Society/societyMemberSchema.js";
import Spend from "../models/Event/SpendSchema.js";
import cloudinary from "../config/cloudinary.js";

// =====================================================
// POST /api/spends/addSpend
// Only admins can add — auto-approved on creation since
// the creator IS the approver in this permission model.
// =====================================================
export const addSpend = async (req, res) => {
  try {
    const {
      event,
      title,
      amount,
      category,
      paidBy,
      paidTo,
      notes,
      spendDate,
      receiptNumber,
    } = req.body;

    if (!event || !title || !amount || !paidBy) {
      return res.status(400).json({
        success: false,
        message: "Event, title, amount and paidBy are required",
      });
    }

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingEvent = await Event.findById(event);
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // ── Permission Check ──────────────────────────────────────
    if (existingEvent.society) {
      const societyAdmin = await SocietyMember.findOne({
        society: existingEvent.society,
        user: dbUser._id,
        role: "admin",
      });
      if (!societyAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only society admins can add spends",
        });
      }
    } else {
      const eventAdmin = await EventMember.findOne({
        event: existingEvent._id,
        user: dbUser._id,
        role: "admin",
      });
      if (!eventAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only event admins can add spends",
        });
      }
    }

    let receiptImage = "";
    if (req.file) {
      const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
        folder: "spends",
      });
      receiptImage = uploadedImage.secure_url;
    }

    const spend = await Spend.create({
      event,
      title: title.trim(),
      amount: Number(amount),
      category: category || "Other",
      paidBy,
      paidTo: paidTo || "",
      notes: notes || "",
      spendDate: spendDate || Date.now(),
      receiptNumber: receiptNumber || "",
      receiptImage,
      createdBy: dbUser._id,
      status: "approved", // creator is the admin/approver, so auto-approve
      approvedBy: dbUser._id,
    });

    return res.status(201).json({
      success: true,
      message: "Spend added successfully",
      data: spend,
    });
  } catch (error) {
    console.error("Add Spend Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add spend",
      error: error.message,
    });
  }
};

// =====================================================
// GET /api/spends/event/:eventId
// =====================================================
export const getEventSpends = async (req, res) => {
  try {
    const { eventId } = req.params;

    const existingEvent = await Event.findById(eventId).lean();
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const spends = await Spend.find({ event: eventId })
      .populate("paidBy", "name email")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .sort({ spendDate: -1 });

    const totalSpent = spends.reduce((sum, s) => sum + s.amount, 0);

    return res.status(200).json({
      success: true,
      data: {
        event: existingEvent,
        spends,
        summary: {
          totalSpent,
          totalCount: spends.length,
          pendingCount: spends.filter((s) => s.status === "pending").length,
          approvedCount: spends.filter((s) => s.status === "approved").length,
          rejectedCount: spends.filter((s) => s.status === "rejected").length,
          remainingBudget: (existingEvent.budget?.target || 0) - totalSpent,
          totalBudget: existingEvent.budget?.target || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get Event Spends Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch spends",
      error: error.message,
    });
  }
};

// =====================================================
// PUT /api/spends/:spendId
// =====================================================
export const updateSpend = async (req, res) => {
  try {
    const { spendId } = req.params;
    const {
      title,
      amount,
      category,
      paidBy,
      paidTo,
      notes,
      spendDate,
      receiptNumber,
    } = req.body;

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const spend = await Spend.findById(spendId);
    if (!spend) {
      return res.status(404).json({ success: false, message: "Spend not found" });
    }

    const existingEvent = await Event.findById(spend.event);

    if (existingEvent.society) {
      const societyAdmin = await SocietyMember.findOne({
        society: existingEvent.society,
        user: dbUser._id,
        role: "admin",
      });
      if (!societyAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only society admins can update spends",
        });
      }
    } else {
      const eventAdmin = await EventMember.findOne({
        event: existingEvent._id,
        user: dbUser._id,
        role: "admin",
      });
      if (!eventAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only event admins can update spends",
        });
      }
    }

    let receiptImage = spend.receiptImage;
    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "spends",
      });
      receiptImage = uploaded.secure_url;
    }

    if (title) spend.title = title.trim();
    if (amount) spend.amount = Number(amount);
    if (category) spend.category = category;
    if (paidBy) spend.paidBy = paidBy;
    if (paidTo !== undefined) spend.paidTo = paidTo;
    if (notes !== undefined) spend.notes = notes;
    if (spendDate) spend.spendDate = spendDate;
    if (receiptNumber !== undefined) spend.receiptNumber = receiptNumber;
    spend.receiptImage = receiptImage;

    await spend.save();

    const updated = await Spend.findById(spendId)
      .populate("paidBy", "name email")
      .populate("createdBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Spend updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update Spend Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update spend",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE /api/spends/:spendId
// =====================================================
export const deleteSpend = async (req, res) => {
  try {
    const { spendId } = req.params;

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const spend = await Spend.findById(spendId);
    if (!spend) {
      return res.status(404).json({ success: false, message: "Spend not found" });
    }

    const existingEvent = await Event.findById(spend.event);

    if (existingEvent.society) {
      const societyAdmin = await SocietyMember.findOne({
        society: existingEvent.society,
        user: dbUser._id,
        role: "admin",
      });
      if (!societyAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only society admins can delete spends",
        });
      }
    } else {
      const eventAdmin = await EventMember.findOne({
        event: existingEvent._id,
        user: dbUser._id,
        role: "admin",
      });
      if (!eventAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only event admins can delete spends",
        });
      }
    }

    if (spend.receiptImage) {
      const publicId = spend.receiptImage
        .split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    await Spend.findByIdAndDelete(spendId);

    return res.status(200).json({
      success: true,
      message: "Spend deleted successfully",
    });
  } catch (error) {
    console.error("Delete Spend Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete spend",
      error: error.message,
    });
  }
};