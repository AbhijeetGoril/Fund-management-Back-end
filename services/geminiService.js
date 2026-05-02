import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateDescription(title) {
  // FIX: Changed "gemini-1.5-flash" to "gemini-2.5-flash" or "gemini-pro"
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Context: You are an assistant for a 'Society & Event Fund Management' app.
    Task: Write a professional 4-line event description for: "${title}".
    
    Rules:
    - Keep it under 50 words.
    - Mention fund transparency or organization if it's a society event.
    - If it's an individual task, focus on personal expense tracking.
    
    Return only the description text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback for your project
    return `Management and financial tracking for ${title} to ensure transparency and organization.`;
  }
}