import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "@/config/db"
import { projects, messages, files, artifacts, figmaTokens } from "@/config/schema"
import { eq } from "drizzle-orm"
import { SYSTEM_PROMPT } from "@/lib/common/prompts/prompt"  // Adjust path if needed

// Helper functions (same as before)
function extractCodeBlocks(content: string) {
  const cleanContent = content
    .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, "")
    .replace(/<search>[\s\S]*?<\/search>/gi, "")

  const codeBlockRegex = /```(\w+)\s+file="([^"]+)"\n([\s\S]*?)```/g
  const blocks: Array<{ language: string; path: string; content: string }> = []
  let match

  while ((match = codeBlockRegex.exec(cleanContent)) !== null) {
    blocks.push({
      language: match[1],
      path: match[2],
      content: match[3].trim(),
    })
  }

  return blocks
}

function removeCodeBlocks(content: string) {
  return content
    .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, "")
    .replace(/<search>[\s\S]*?<\/search>/gi, "")
    .replace(/```(\w+)\s+file="([^"]+)"\n[\s\S]*?```/g, "")
    .trim()
}

async function saveFigmaResponse(
  projectId: string,
  fullResponse: string,
  userId: string,
) {
  const codeBlocks = extractCodeBlocks(fullResponse)
  const cleanContent = removeCodeBlocks(fullResponse)
  const hasArtifact = codeBlocks.length > 0

  const [newMessage] = await db
    .insert(messages)
    .values({
      projectId,
      role: "assistant",
      content: cleanContent,
      hasArtifact,
      thinking: null,
      searchQueries: null,
    })
    .returning()

  if (hasArtifact && codeBlocks.length > 0) {
    const existingFiles = await db.select().from(files).where(eq(files.projectId, projectId))
    const fileIds: string[] = []

    for (const block of codeBlocks) {
      const previousFile = existingFiles.find((f) => f.path === block.path)
      const previousContent = previousFile?.content ?? ""
      const previousLines = previousContent.split("\n").length
      const newLines = block.content.split("\n").length
      const additions = Math.max(0, newLines - previousLines)
      const deletions = Math.max(0, previousLines - newLines)

      const [file] = await db
        .insert(files)
        .values({
          projectId,
          messageId: newMessage.id,
          path: block.path,
          content: block.content,
          language: block.language,
          additions,
          deletions,
        })
        .returning()

      fileIds.push(file.id)
    }

    await db.insert(artifacts).values({
      projectId,
      messageId: newMessage.id,
      title: `Figma Clone from ${new Date().toLocaleString()}`,
      fileIds,
    })
  }

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId))
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { fileKey } = body
  if (!fileKey) {
    return NextResponse.json({ error: "Missing fileKey" }, { status: 400 })
  }

  try {
    // Get stored PAT
    const [tokenRow] = await db
      .select({ accessToken: figmaTokens.accessToken })
      .from(figmaTokens)
      .where(eq(figmaTokens.userId, userId))
      .limit(1)

    if (!tokenRow) {
      return NextResponse.json({ error: "Not connected to Figma" }, { status: 401 })
    }

    // Fetch Figma file JSON
    const fileRes = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { Authorization: `Bearer ${tokenRow.accessToken}` },
    })

    if (!fileRes.ok) {
      console.error("[Figma Import] Fetch file error:", fileRes.statusText)
      return NextResponse.json({ error: "Failed to fetch design" }, { status: fileRes.status })
    }

    const figmaData = await fileRes.json()

    // Create new project
    const title = `Figma Clone: ${figmaData.name || "Untitled Design"}`
    const [project] = await db
      .insert(projects)
      .values({
        userId,
        title,
        selectedModel: "gemini",
      })
      .returning({ id: projects.id })

    // Insert user message
    await db.insert(messages).values({
      projectId: project.id,
      role: "user",
      content: `Clone this Figma design to Next.js code: https://www.figma.com/file/${fileKey}`,
    })

    // Generate code with Gemini
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    const figmaJson = JSON.stringify(figmaData, null, 2)
    const figmaPrompt = `Generate a complete, responsive Next.js website (using Tailwind CSS) that exactly replicates this Figma design. 

- Match colors (RGBA to hex/Tailwind classes, e.g., bg-[#336699]).
- Match fonts (include Google Fonts imports, e.g., Inter).
- Match sizes/positions (use px/rem, flex/grid layouts).
- Structure: app/page.tsx for entry, components/ for reusable parts, globals.css if needed.
- Make mobile-friendly with responsive classes.
- Output ONLY fenced code blocks like:
\`\`\`tsx file="app/page.tsx"
export default function Page() {
  return <div>...</div>
}
\`\`\`

Figma JSON: ${figmaJson}`

    const fullPrompt = SYSTEM_PROMPT + "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/page.tsx, components/Hero.tsx) in Next.js/Tailwind style—ensure fenced blocks for each." + "\n\n" + figmaPrompt

    const result = await model.generateContent(fullPrompt)
    const fullResponse = result.response.text()

    // Save response
    await saveFigmaResponse(project.id, fullResponse, userId)

    return NextResponse.json({ projectId: project.id })
  } catch (error) {
    console.error("[Figma Import] Error:", error)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}