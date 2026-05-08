import { GoogleGenerativeAI } from "@google/generative-ai";

// 2026 Stable Model ID
const MODEL_NAME = "gemini-2.5-flash";

export async function generateDescription(title) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
      You are an assistant for a Society & Event Fund Management system.

Write a professional event description based on the given title.

Event Title: "${title}"

Instructions:
- Write exactly 3–4 short lines
- Use simple and clear language
- Focus on:
  • community participation  
  • event organization  
  • fund usage and transparency  
- If the event is society-related → highlight collective effort and shared funds  
- If general event → focus on planning, purpose, and participation  

Rules:
- Do NOT start with "This tool helps manage"
- Do NOT include extra explanation
- Do NOT repeat the title
- Keep total length under 40 words

Return ONLY the description text.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Description API Error:", error);
    return `An organized system to manage ${title}, ensuring all related funds and expenses are tracked with transparency.`;
  }
}

export async function generateEventCategory(title) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
      Return ONLY a JSON object for: "${title}".
      Categories: [Personal, Travel, Health, Tech, Education, Finance, Maintenance, Cultural, Sports, Social, Meeting, Emergency, Other].
      Format: {"category": "...", "description": "..."}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean potential markdown formatting
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return {
      category: data.category || "Other",
      description: data.description || `Event management for ${title}.`,
    };
  } catch (error) {
    console.error("Category API Error:", error);
    return {
      category: "Other",
      description: `Organized tracking for ${title}.`,
    };
  }
}
