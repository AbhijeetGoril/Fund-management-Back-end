import { generateDescription } from "../services/geminiService.js";

export const suggestDescription = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const description = await generateDescription(title);

    res.json({ description });f
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};