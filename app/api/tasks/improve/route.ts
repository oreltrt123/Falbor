import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { userCredits } from "@/config/schema"
import { eq, sql } from "drizzle-orm"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { description } = body

    if (!description) {
      return new Response(JSON.stringify({ error: "Description required" }), { status: 400 })
    }

    // Check credits
    const [userCredit] = await db.select().from(userCredits).where(eq(userCredits.userId, userId))

    if (!userCredit || userCredit.credits < 1) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: { responseMimeType: "text/plain" },
    })

    const systemInstruction = `You are an expert at improving task descriptions.
Take the user's original task description and rewrite it to be:
- More professional and clear
- Actionable and specific
- Well-structured with proper details
- Concise but comprehensive

Return **only** the improved task description – nothing else.`.trim()

    const fullPrompt = `${systemInstruction}\n\nOriginal task description:\n"${description}"`

    const result = await model.generateContent(fullPrompt)
    const improved = result.response.text().trim()

    await db
      .update(userCredits)
      .set({ credits: sql`${userCredits.credits} - 1` })
      .where(eq(userCredits.userId, userId))

    return new Response(JSON.stringify({ improved }), { status: 200 })
  } catch (error) {
    console.error("Failed to improve task:", error)
    return new Response(JSON.stringify({ error: "Failed to improve task" }), { status: 500 })
  }
}
