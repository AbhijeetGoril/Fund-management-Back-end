import OpenAI from "openai";
const client=new OpenAI({
  apiKey:process.env.OPENAI_API_KEY,
})

export async function generateDescription(title) {
  const response=await client.chat.completions.create({
    model:"gpt-4.1-mini",
    messages:[
      {role:"user",
        content: `Write a short and simple event description for: "${title}"`,
      }
    ]
  }
)
  return response.choices[0].message.content.trim();
}