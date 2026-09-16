import Society from "../models/Society/Society.js";
import Event from "../models/Event/Event.js";
import EventMember from "../models/Event/EventMemberSchema.js";

export const getHomeStats = async (req, res) => {
  try {
    // ============================================
    // TOTAL SOCIETIES
    // ============================================

    const totalSocieties = await Society.countDocuments();

    // ============================================
    // TOTAL EVENTS
    // ============================================

    const totalEvents = await Event.countDocuments();

    // ============================================
    // TOTAL UNIQUE MEMBERS
    // ============================================

    const totalMembersResult = await EventMember.aggregate([
      {
        $match: {
          status: "active",
          user: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$user",
        },
      },
      {
        $count: "total",
      },
    ]);

    const totalMembers = totalMembersResult[0]?.total || 0;

    // ============================================
    // TOTAL FUNDS MANAGED
    // ============================================

    const totalFundsResult = await EventMember.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amountPaid",
          },
        },
      },
    ]);

    const totalFunds = totalFundsResult[0]?.total || 0;

    // ============================================
    // DATE RANGE
    // ============================================

    const now = new Date();

    // Last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // 30 to 60 days ago
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // ============================================
    // CURRENT 30 DAYS FUNDS
    // Today → 30 days ago
    // ============================================

    const current30DaysResult = await EventMember.aggregate([
      {
        $match: {
          updatedAt: {
            $gte: thirtyDaysAgo,
            $lt: now,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amountPaid",
          },
        },
      },
    ]);

    const current30DaysFunds =
      current30DaysResult[0]?.total || 0;

    // ============================================
    // PREVIOUS 30 DAYS FUNDS
    // 30 → 60 days ago
    // ============================================

    const previous30DaysResult = await EventMember.aggregate([
      {
        $match: {
          updatedAt: {
            $gte: sixtyDaysAgo,
            $lt: thirtyDaysAgo,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amountPaid",
          },
        },
      },
    ]);

    const previous30DaysFunds =
      previous30DaysResult[0]?.total || 0;

    // ============================================
    // FUND GROWTH
    // ============================================

    let fundGrowth = 0;

    if (previous30DaysFunds > 0) {
      fundGrowth =
        ((current30DaysFunds - previous30DaysFunds) /
          previous30DaysFunds) *
        100;
    } else if (current30DaysFunds > 0) {
      fundGrowth = 100;
    }

    fundGrowth = Number(fundGrowth.toFixed(1));

    // ============================================
    // COMPLETED EVENTS
    // ============================================

    const completedEvents = await Event.countDocuments({
      status: "completed",
    });

    // ============================================
    // SUCCESS RATE
    // ============================================

    const successRate =
      totalEvents > 0
        ? Math.round((completedEvents / totalEvents) * 100)
        : 0;

    // ============================================
    // RESPONSE
    // ============================================

    res.status(200).json({
      success: true,

      data: {
        totalSocieties,
        totalEvents,
        totalMembers,

        totalFunds,

        current30DaysFunds,
        previous30DaysFunds,
        fundGrowth,

        completedEvents,
        successRate,
      },
    });
  } catch (error) {
    console.error("Home stats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch home statistics",
    });
  }
};