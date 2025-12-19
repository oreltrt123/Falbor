import { auth } from "@clerk/nextjs/server"
import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "@/config/db"
import { projects, messages, files, artifacts, userCustomKnowledge } from "@/config/schema"
import { eq, asc } from "drizzle-orm"
import { SYSTEM_PROMPT } from "@/lib/common/prompts/prompt"
import { DISCUSS_SYSTEM_PROMPT } from "@/lib/common/prompts/discuss-prompt"

const CODE_KEYWORDS = [
  "build",
  "create",
  "make",
  "website",
  "app",
  "component",
  "function",
  "page",
  "form",
  "dashboard",
  "api",
  "code",
  "implement",
  "develop",
  "generate code",
  "write code",
]

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
  }

  const {
    projectId: incomingProjectId,
    message,
    imageData,
    uploadedFiles,
    discussMode = false,
    isAutomated = false,
  } = body

  if (!message) {
    return new Response(JSON.stringify({ error: "Missing message" }), { status: 400 })
  }

  let projectId = incomingProjectId
  let isNewProject = false

  if (!projectId) {
    isNewProject = true
    const [newProject] = await db
      .insert(projects)
      .values({
        userId,
        title: message.length > 50 ? `${message.substring(0, 47)}...` : message,
        selectedModel: "hybrid",
        isAutomated,
      })
      .returning({ id: projects.id })
    projectId = newProject.id

    await db.insert(messages).values({
      projectId,
      role: "user",
      content: message,
      isAutomated,
    })
  }

  let project: any
  try {
    ;[project] = await db.select().from(projects).where(eq(projects.id, projectId))
  } catch (e) {
    console.error("[API/Chat] DB select error:", e)
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 })
  }

  if (!project || project.userId !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  if (!isNewProject) {
    try {
      await db.insert(messages).values({
        projectId,
        role: "user",
        content: message,
        isAutomated,
      })
    } catch (e) {
      console.error("[API/Chat] User insert error:", e)
      return new Response(JSON.stringify({ error: "Failed to save message" }), { status: 500 })
    }
  }

  let history: any[]
  try {
    history =
      (await db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.createdAt))) ?? []
  } catch (e) {
    console.error("[API/Chat] History fetch error:", e)
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 })
  }

  const responseStream = await handleHybridRequest(
    history,
    message,
    imageData,
    projectId,
    userId,
    discussMode,
    isAutomated,
  )

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function mapHistoryToGemini(history: any[]) {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }))
}

async function handleHybridRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean,
) {
  const isCodeRequest = CODE_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))

  console.log(`[Hybrid] Code request detected: ${isCodeRequest} for message: "${message.substring(0, 50)}..."`)

  const openaiKey = process.env.OPENAI_API_KEY
  const googleKey = process.env.GOOGLE_API_KEY

  if (!openaiKey || !googleKey) {
    return createErrorStream(
      "API keys not configured. Please add OPENAI_API_KEY and GOOGLE_API_KEY to your environment variables.",
    )
  }

  let openai: any
  let genAI: any
  try {
    openai = new OpenAI({ apiKey: openaiKey })
    genAI = new GoogleGenerativeAI(googleKey)
  } catch (e) {
    console.error("[Hybrid] SDK init error:", e)
    return createErrorStream(`Failed to initialize AI clients: ${e}`)
  }

  const maxContinuations = 5
  const continueMessage = "Continue exactly from where you left off without repeating any previous content."

  try {
    const customKnowledgePrompt = await getCustomKnowledge(userId)
    const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + customKnowledgePrompt

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let explanationResponse = ""
    let codeResponse = ""

    const gptModel = "gpt-4o"
    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 8192 },
    })

    return new ReadableStream({
      async start(controller) {
        try {
          if (!isCodeRequest) {
            console.log("[Hybrid] Using GPT-4o for conversational response")

            const messages = [
              { role: "system", content: systemPrompt },
              ...conversationHistory.map((msg) => ({ role: msg.role, content: msg.content })),
              { role: "user", content: message },
            ]

            let continuationCount = 0
            do {
              const stream = await openai.chat.completions.create({
                model: gptModel,
                messages,
                max_tokens: 8192,
                stream: true,
              })

              let stopReason = null
              for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || ""
                if (text) {
                  explanationResponse += text
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
                if (chunk.choices[0]?.finish_reason) {
                  stopReason = chunk.choices[0].finish_reason
                }
              }

              if (stopReason === "length" && continuationCount < maxContinuations) {
                continuationCount++
                messages.push({ role: "assistant", content: explanationResponse })
                messages.push({ role: "user", content: continueMessage })
              } else {
                break
              }
            } while (true)

            await saveAssistantMessage(
              projectId,
              explanationResponse,
              [],
              controller,
              encoder,
              undefined,
              false,
              discussMode,
              isAutomated,
            )
          } else {
            console.log("[Hybrid] Using GPT-4o + Gemini for code generation")

            const explanationPrompt = `${message}\n\nYou are the explanation expert. Provide a clear, helpful response explaining what you'll build and how it works. Keep it concise (2-4 paragraphs). The code specialist will handle the actual implementation.`

            const codePrompt = `${message}\n\nYou are the code generation expert. Generate ONLY the code files requested with proper syntax:\n\`\`\`language file="path/to/file.ext"\n// code here\n\`\`\`\n\nDo NOT include explanations - the explanation expert handles that. Focus purely on generating clean, production-ready code.`

            console.log("[Hybrid] Streaming GPT-4o explanation...")

            const messages = [
              { role: "system", content: "You provide clear explanations. Be concise and helpful." },
              ...conversationHistory.map((msg) => ({ role: msg.role, content: msg.content })),
              { role: "user", content: explanationPrompt },
            ]

            let continuationCount = 0
            do {
              const stream = await openai.chat.completions.create({
                model: gptModel,
                messages,
                max_tokens: 2000,
                stream: true,
              })

              let stopReason = null
              for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || ""
                if (text) {
                  explanationResponse += text
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
                if (chunk.choices[0]?.finish_reason) {
                  stopReason = chunk.choices[0].finish_reason
                }
              }

              if (stopReason === "length" && continuationCount < maxContinuations) {
                continuationCount++
                messages.push({ role: "assistant", content: explanationResponse })
                messages.push({ role: "user", content: continueMessage })
              } else {
                break
              }
            } while (true)

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "\n\n**Code:**\n\n" })}\n\n`))

            console.log("[Hybrid] Streaming Gemini code...")

            const contents = [
              ...mapHistoryToGemini(conversationHistory),
              { role: "user", parts: [{ text: codePrompt }] },
            ]

            continuationCount = 0
            do {
              const stream = await geminiModel.generateContentStream({
                contents,
              })

              let finishReason = null
              for await (const chunk of stream.stream) {
                const part = chunk.candidates?.[0]?.content?.parts?.[0]
                if (part?.text) {
                  codeResponse += part.text
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`))
                }
                if (chunk.candidates?.[0]?.finishReason) {
                  finishReason = chunk.candidates[0].finishReason
                }
              }

              if (finishReason === "MAX_TOKENS" && continuationCount < maxContinuations) {
                continuationCount++
                contents.push({ role: "model", parts: [{ text: codeResponse }] })
                contents.push({ role: "user", parts: [{ text: continueMessage }] })
              } else {
                break
              }
            } while (true)

            const fullResponse = `**Response:**\n\n${explanationResponse}\n\n**Code:**\n\n${codeResponse}`

            console.log(
              `[Hybrid] GPT-4o response length: ${explanationResponse.length}, Gemini response length: ${codeResponse.length}`,
            )
            console.log(`[Hybrid] Extracted code blocks: ${extractCodeBlocks(fullResponse).length}`)

            await saveAssistantMessage(
              projectId,
              fullResponse,
              [],
              controller,
              encoder,
              undefined,
              false,
              discussMode,
              isAutomated,
            )
          }
        } catch (error) {
          console.error("[Hybrid] Stream error:", error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[Hybrid] Handler error:", e)
    return createErrorStream(`Hybrid handler failed: ${e}`)
  }
}

function createErrorStream(errorMsg: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errorMsg })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      controller.close()
    },
  })
}

async function saveAssistantMessage(
  projectId: string,
  fullResponse: string,
  searchQueries: any[],
  controller: any,
  encoder: any,
  uploadedFiles?: any[],
  generateImages?: boolean,
  discussMode = false,
  isAutomated = false,
) {
  try {
    console.log("[Save] Extracting code blocks from response...")
    const codeBlocks = discussMode ? [] : extractCodeBlocks(fullResponse)
    console.log(`[Save] Found ${codeBlocks.length} code blocks`)

    const cleanContent = discussMode ? fullResponse.trim() : removeCodeBlocks(fullResponse)
    const hasArtifact = codeBlocks.length > 0 && !discussMode

    console.log("[Save] Inserting message into database...")
    const [newMessage] = await db
      .insert(messages)
      .values({
        projectId,
        role: "assistant",
        content: cleanContent,
        hasArtifact,
        searchQueries: searchQueries.length > 0 ? searchQueries : null,
        isAutomated,
      })
      .returning()

    console.log("[Save] Message inserted with ID:", newMessage.id)

    if (hasArtifact && codeBlocks.length > 0) {
      const existingFiles = await db.select().from(files).where(eq(files.projectId, projectId))
      const fileIds: string[] = []

      console.log("[Save] Processing code blocks...")
      for (const block of codeBlocks) {
        console.log(`[Save] Inserting file: ${block.path}`)

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
        console.log(`[Save] File inserted: ${file.id}`)
      }

      console.log("[Save] Creating artifact...")
      await db.insert(artifacts).values({
        projectId,
        messageId: newMessage.id,
        title: `Code from ${new Date().toLocaleString()}`,
        fileIds,
      })
      console.log("[Save] Artifact created")
    }

    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId))

    console.log("[Save] Sending done signal to client")
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ done: true, messageId: newMessage.id, hasArtifact, projectId })}\n\n`),
    )
  } catch (e) {
    console.error("[Save] Assistant error:", e)
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to save response" })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
    } catch (sendError) {
      console.error("[Save] Error sending error message:", sendError)
    }
  } finally {
    controller.close()
  }
}

function extractCodeBlocks(content: string) {
  const codeBlockRegex = /```(\w+)\s+file="([^"]+)"\n([\s\S]*?)```/g
  const blocks: Array<{ language: string; path: string; content: string }> = []
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1],
      path: match[2],
      content: match[3].trim(),
    })
  }

  return blocks
}

function removeCodeBlocks(content: string) {
  return content.replace(/```(\w+)\s+file="([^"]+)"\n[\s\S]*?```/g, "").trim()
}

async function getCustomKnowledge(userId: string): Promise<string> {
  try {
    const [customKnowledge] = await db.select().from(userCustomKnowledge).where(eq(userCustomKnowledge.userId, userId))

    if (customKnowledge && customKnowledge.promptContent) {
      return `\n\n### USER CUSTOM KNOWLEDGE ###\nThe user has provided the following custom instructions that you MUST follow in all generations:\n\n**${customKnowledge.promptName}**\n${customKnowledge.promptContent}\n\n### END CUSTOM KNOWLEDGE ###\n`
    }
  } catch (error) {
    console.error("[API/Chat] Failed to fetch custom knowledge:", error)
  }
  return ""
}
