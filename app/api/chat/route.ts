// app/api/chat/route.ts (or wherever the POST handler is defined)
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/config/db"
import { projects, messages, files, artifacts } from "@/config/schema"
import { eq, asc } from "drizzle-orm"
import { SYSTEM_PROMPT } from "@/lib/common/prompts/prompt"
import { DISCUSS_SYSTEM_PROMPT } from "@/lib/common/prompts/discuss-prompt"

const UI_KEYWORDS = [
  "ui",
  "component",
  "design",
  "website",
  "app",
  "interface",
  "build site",
  "frontend",
  "react component",
  "todo",
  "dashboard",
  "form",
  "crud",
] // Broadened for better triggering

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
    model = "gemini",
    generateImages,
    discussMode = false,
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
        selectedModel: model,
      })
      .returning({ id: projects.id })
    projectId = newProject.id

    // Insert user message for new project
    await db.insert(messages).values({
      projectId,
      role: "user",
      content: message,
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

  // If not a new project, insert the user message
  if (!isNewProject) {
    try {
      await db.insert(messages).values({
        projectId,
        role: "user",
        content: message,
      })
    } catch (e) {
      console.error("[API/Chat] User insert error:", e)
      return new Response(JSON.stringify({ error: "Failed to save message" }), { status: 500 })
    }
  }

  try {
    await db.update(projects).set({ selectedModel: model }).where(eq(projects.id, projectId))
  } catch (e) {
    console.error("[API/Chat] Model update error:", e)
  }

  let history: any[]
  try {
    history =
      (await db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.createdAt))) ?? []
  } catch (e) {
    console.error("[API/Chat] History fetch error:", e)
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 })
  }

  let responseStream: ReadableStream<Uint8Array>

  if (model === "gemini") {
    responseStream = await handleGeminiRequest(
      history,
      message,
      imageData,
      uploadedFiles,
      generateImages,
      projectId,
      userId,
      discussMode,
    )
  } else if (model === "claude") {
    responseStream = await handleClaudeRequest(history, message, imageData, projectId, userId, discussMode)
  } else if (model === "gpt") {
    responseStream = await handleGPTRequest(history, message, imageData, projectId, userId, discussMode)
  } else if (model === "v0") {
    responseStream = await handleV0Request(history, message, projectId, userId, discussMode)
  } else {
    return new Response(JSON.stringify({ error: "Unknown model" }), { status: 400 })
  }

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

async function doSearch(query: string): Promise<{ query: string; results: string }> {
  try {
    if (!process.env.SERPAPI_API_KEY) {
      throw new Error("SERPAPI_API_KEY not set")
    }
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      api_key: process.env.SERPAPI_API_KEY!,
      num: "5",
    })
    const response = await fetch(`https://serpapi.com/search?${params.toString()}`)
    const data = await response.json()
    const results =
      data.organic_results?.map((r: any) => `${r.title}: ${r.snippet} (${r.link})`).join("\n") ||
      "No relevant results found."
    return { query, results }
  } catch (error) {
    console.error("[API/Chat] SerpAPI search error:", error)
    return { query, results: "Search unavailable; proceeding with internal knowledge." }
  }
}

async function handleGeminiRequest(
  history: any[],
  message: string,
  imageData: any,
  uploadedFiles: any[],
  generateImages: boolean,
  projectId: string,
  userId: string,
  discussMode: boolean,
) {
  let genAI: GoogleGenerativeAI
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  } catch (e) {
    console.error("[Gemini] API key error:", e)
    return createErrorStream("Gemini API key missing or invalid")
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

  const searchQuery = message
  const searchResult = await doSearch(searchQuery)
  console.log(`[Gemini] Search for "${searchQuery}": ${searchResult.results.substring(0, 100)}...`)

  // 21st.dev integration via prompt (no external call needed)
  const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
  console.log(`[Gemini] UI request detected: ${isUIRequest} for message: ${message.substring(0, 50)}...`)
  const uiContext = isUIRequest
    ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
    : ""

  const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext

  const conversationHistory = [
    {
      role: "user",
      parts: [{ text: systemPrompt + `\n\nContext from web search on "${searchQuery}":\n${searchResult.results}` }],
    },
    {
      role: "model",
      parts: [
        {
          text: discussMode
            ? "Understood. I'll engage in conversation without generating code."
            : "Understood. I'll use the provided web search context and format code blocks properly with file paths.",
        },
      ],
    },
    ...history.slice(0, -1).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
  ]

  const messageParts: any[] = [{ text: message }]
  if (imageData) {
    messageParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    })
  }

  const chat = model.startChat({
    history: conversationHistory,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
    },
  })

  let result
  try {
    result = await chat.sendMessageStream(messageParts)
  } catch (e) {
    console.error("[Gemini] Stream error:", e)
    return createErrorStream(`Gemini request failed: ${e}`)
  }

  const encoder = new TextEncoder()
  let fullResponse = ""

  return new ReadableStream({
    async start(controller) {
      try {
        console.log("[Gemini] Starting stream for project:", projectId)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          fullResponse += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          console.log("[Gemini] Chunk sent, length:", text.length)
        }

        console.log(`[Gemini] Extracted code blocks: ${discussMode ? 0 : extractCodeBlocks(fullResponse).length}`)

        await saveAssistantMessage(
          projectId,
          fullResponse,
          [searchResult],
          "", // thinkingContent is empty for Gemini
          controller,
          encoder,
          uploadedFiles,
          generateImages,
          discussMode,
        )

        console.log("[Gemini] Message saved successfully")
      } catch (error) {
        console.error("[Gemini] Stream processing error:", error)
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } catch (e) {
          console.error("[Gemini] Error sending error message:", e)
        }
      } finally {
        controller.close()
      }
    },
  })
}

async function handleClaudeRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return createErrorStream(
      "Claude API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.",
    )
  }

  let anthropic: any
  try {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  } catch (e) {
    console.error("[Claude] SDK init error:", e)
    return createErrorStream(`Claude SDK failed: ${e}`)
  }

  try {
    const searchQuery = message
    const searchResult = await doSearch(searchQuery)
    console.log(`[Claude] Search for "${searchQuery}": ${searchResult.results.substring(0, 100)}...`)

    const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
    console.log(`[Claude] UI request detected: ${isUIRequest}`)
    const uiContext = isUIRequest
      ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
      : ""

    const systemPrompt =
      (discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext) +
      `\n\nContext from web search: ${searchResult.results}`

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""
    const thinkingContent = ""

    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 8192,
            system: systemPrompt,
            messages: [...conversationHistory, { role: "user", content: message }],
            stream: true,
          })

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = event.delta.text
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          console.log(`[Claude] Extracted code blocks: ${discussMode ? 0 : extractCodeBlocks(fullResponse).length}`)

          await saveAssistantMessage(
            projectId,
            fullResponse,
            [searchResult],
            thinkingContent,
            controller,
            encoder,
            undefined,
            false,
            discussMode,
          )
        } catch (error) {
          console.error("[Claude] Stream error:", error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[Claude] Handler error:", e)
    return createErrorStream(`Claude handler failed: ${e}`)
  }
}

async function handleGPTRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
) {
  if (!process.env.OPENAI_API_KEY) {
    return createErrorStream("OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.")
  }

  let openai: any
  try {
    const OpenAI = (await import("openai")).default
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  } catch (e) {
    console.error("[GPT] SDK load error:", e)
    return createErrorStream(`Failed to load OpenAI SDK: ${e}`)
  }

  try {
    const searchQuery = message
    const searchResult = await doSearch(searchQuery)
    console.log(`[GPT] Search for "${searchQuery}": ${searchResult.results.substring(0, 100)}...`)

    const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
    console.log(`[GPT] UI request detected: ${isUIRequest}`)
    const uiContext = isUIRequest
      ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
      : ""

    const systemPrompt =
      (discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext) +
      `\n\nContext from web search: ${searchResult.results}`

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""
    const thinkingContent = ""

    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content: message },
            ],
            stream: true,
            max_tokens: 8192,
          })

          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) {
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          console.log(`[GPT] Extracted code blocks: ${discussMode ? 0 : extractCodeBlocks(fullResponse).length}`)

          await saveAssistantMessage(
            projectId,
            fullResponse,
            [searchResult],
            thinkingContent,
            controller,
            encoder,
            undefined,
            false,
            discussMode,
          )
        } catch (error) {
          console.error("[GPT] Stream error:", error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[GPT] Handler error:", e)
    return createErrorStream(`GPT handler failed: ${e}`)
  }
}

async function handleV0Request(
  history: any[],
  message: string,
  projectId: string,
  userId: string,
  discussMode: boolean,
) {
  if (discussMode) {
    return createErrorStream(
      "Discuss mode is not supported with v0 (code generation model). Please switch to another model.",
    )
  }
  return createErrorStream("v0 integration coming soon. This will use Vercel's v0 API for enhanced code generation.")
}

function createErrorStream(errorMsg: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      const fallbackText = errorMsg.includes("request failed")
        ? `<Thinking>Basic fallback mode activated due to temp issue.</Thinking>\nResponse generated without full AI assistance. Search and steps will retry next time.`
        : errorMsg
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fallbackText })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      controller.close()
    },
  })
}

async function saveAssistantMessage(
  projectId: string,
  fullResponse: string,
  searchQueries: any[],
  thinkingContent: string,
  controller: any,
  encoder: any,
  uploadedFiles?: any[],
  generateImages?: boolean,
  discussMode = false,
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
        thinking: thinkingContent || null,
        searchQueries: searchQueries.length > 0 ? searchQueries : null,
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
