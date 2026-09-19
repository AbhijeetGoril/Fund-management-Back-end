// controllers/helpBotController.js

import { groq, HELP_BOT_MODEL } from "../config/groqClient.js";
import HELP_BOT_KNOWLEDGE from "../knowledge/helpBotKnowledge.js";

// Simple in-memory rate limit: max 20 messages per user per 10 minutes.
// Prevents one user (or a bug in the frontend) from burning through the
// free-tier quota. Fine for a single-server deploy; swap for a Redis-backed
// limiter if you ever run multiple instances.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitBuckets = new Map(); // userId -> { count, windowStart }

function isRateLimited(userId) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(userId);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(userId, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

// POST /api/help-chat
// body: { message: string, history?: [{ role: "user"|"assistant", content: string }] }
const askHelpBot = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: "message is too long (max 2000 characters)" });
    }

    const userId = req.user?.id || req.ip;
    if (isRateLimited(userId)) {
      return res.status(429).json({
        error: "You've sent a lot of messages in a short time. Please wait a few minutes and try again.",
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: "The help bot isn't configured yet. Ask the site admin to set GROQ_API_KEY.",
      });
    }

    // Keep only the last few turns of history to bound token usage.
    const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];

    const messages = [
      { role: "system", content: HELP_BOT_KNOWLEDGE },
      ...trimmedHistory
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      { role: "user", content: message.trim() },
    ];

    const completion = await groq.chat.completions.create({
      model: HELP_BOT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(502).json({ error: "The help bot didn't return an answer. Please try again." });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("[helpBot] askHelpBot error:", error);
    return res.status(500).json({ error: "Something went wrong answering your question. Please try again." });
  }
};

export { askHelpBot };