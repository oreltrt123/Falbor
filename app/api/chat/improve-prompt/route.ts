// app/api/chat/improve-prompt/route.ts
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "@/config/db"
import { projects } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { projectId, prompt } = await request.json()

  if (!projectId || !prompt?.trim()) {
    return new Response(JSON.stringify({ error: "Missing projectId or prompt" }), { status: 400 })
  }

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

  if (!project || project.userId !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    // Force plain-text output
    generationConfig: { responseMimeType: "text/plain" },
  })

  const systemInstruction = `
You are an expert prompt engineer for an AI code-generation assistant.
Take the user's original prompt and rewrite it to be:

- More professional and polished
- Longer and richer in detail while staying concise
- Explicit about desired output, tech stack, edge-cases, and success criteria
- Completely free of any markdown, asterisks, parentheses, code fences, or extra formatting

Return **only** the improved prompt – nothing else.
`.trim()

  const fullPrompt = `${systemInstruction}\n\nOriginal prompt:\n"${prompt}"`

  const result = await model.generateContentStream(fullPrompt)

  const encoder = new TextEncoder()
  let accumulated = ""

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            accumulated += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }

        // Final event with the complete clean prompt
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, improvedPrompt: accumulated.trim() })}\n\n`
          )
        )
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}