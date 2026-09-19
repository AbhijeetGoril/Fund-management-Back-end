// config/groqClient.js
// Thin wrapper around Groq's API for the in-app help bot.
// Groq has a genuinely free tier and is very fast — runs open models like
// Llama 3.1 rather than proprietary ones, which is why it's free.
// Get a key at https://console.groq.com/keys and set GROQ_API_KEY in .env

import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  console.warn(
    "[helpBot] GROQ_API_KEY is not set — the help bot will return an error until it is configured in your .env file."
  );
}

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

// llama-3.1-8b-instant: fast + free-tier friendly, plenty good for grounded
// Q&A over a short knowledge base. Swap for llama-3.3-70b-versatile if you
// want stronger answers and can live with a lower free-tier rate limit.
export const HELP_BOT_MODEL = "openai/gpt-oss-20b";