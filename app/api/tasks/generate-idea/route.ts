import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { userCredits, projects, files } from "@/config/schema"
import { eq, sql } from "drizzle-orm"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 })
    }

    // Check credits
    const [userCredit] = await db.select().from(userCredits).where(eq(userCredits.userId, userId))

    if (!userCredit || userCredit.credits < 1) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 })
    }

    // Get project info
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
    }

    // Get project files to understand what's built
    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId)).limit(10)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: { responseMimeType: "text/plain" },
    })

    const filesList = projectFiles.map((f) => f.path).join(", ")
    const systemInstruction =
      `You are helping with a project called "${project.title}"${project.description ? ` - ${project.description}` : ""}.

The project has these files: ${filesList || "No files yet"}

Based on this project, suggest ONE specific feature or improvement task. Respond in JSON format:
{
  "title": "Short task title (max 50 chars)",
  "description": "Detailed description of what to build and why it would be valuable (2-4 sentences)"
}

Respond with ONLY valid JSON, no extra text.`.trim()

    const result = await model.generateContent(systemInstruction)
    const responseText = result.response.text().trim()

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid AI response")
    }

    const idea = JSON.parse(jsonMatch[0])

    await db
      .update(userCredits)
      .set({ credits: sql`${userCredits.credits} - 1` })
      .where(eq(userCredits.userId, userId))

    return new Response(JSON.stringify(idea), { status: 200 })
  } catch (error) {
    console.error("Failed to generate idea:", error)
    return new Response(JSON.stringify({ error: "Failed to generate idea" }), { status: 500 })
  }
}
