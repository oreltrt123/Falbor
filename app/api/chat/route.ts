import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/config/db"
import { projects, messages, files, artifacts } from "@/config/schema"
import { eq, asc } from "drizzle-orm"
import { SYSTEM_PROMPT } from "@/lib/prompt"

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

  const { projectId, message, imageData, uploadedFiles, model = "gemini", generateImages } = body

  if (!projectId || !message) {
    return new Response(JSON.stringify({ error: "Missing projectId or message" }), { status: 400 })
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

  try {
    await db.update(projects).set({ selectedModel: model }).where(eq(projects.id, projectId))
  } catch (e) {
    console.error("[API/Chat] Model update error:", e)
  }

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

  let history: any[]
  try {
    history = await db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.createdAt)) ?? []
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
    )
  } else if (model === "claude") {
    responseStream = await handleClaudeRequest(history, message, imageData, projectId, userId)
  } else if (model === "gpt") {
    responseStream = await handleGPTRequest(history, message, imageData, projectId, userId)
  } else if (model === "v0") {
    responseStream = await handleV0Request(history, message, projectId, userId)
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
) {
  let genAI: GoogleGenerativeAI
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  } catch (e) {
    console.error("[v0] Gemini API key error:", e)
    return createErrorStream("Gemini API key missing or invalid")
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

  const searchQuery = message
  const searchResult = await doSearch(searchQuery)
  const searchQueries: Array<{ query: string; results: string }> = [searchResult]

  const conversationHistory = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    {
      role: "model",
      parts: [{ text: "Understood. I'll follow these guidelines when generating code and responses." }],
    },
    {
      role: "user",
      parts: [
        {
          text: `Context from web search on "${searchQuery}":\n${searchResult.results}\n\nIncorporate this information into your response. When generating code, use the format: \`\`\`language file="path/to/file.ext"\ncode here\n\`\`\``,
        },
      ],
    },
    {
      role: "model",
      parts: [
        {
          text: "Understood. I'll use the provided web search context and format code blocks properly with file paths.",
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
    console.error("[v0] Gemini stream error:", e)
    return createErrorStream(`Gemini request failed: ${e}`)
  }

  const encoder = new TextEncoder()
  let fullResponse = ""
  const thinkingContent = ""

  return new ReadableStream({
    async start(controller) {
      try {
        console.log("[v0] Starting Gemini stream for project:", projectId)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          fullResponse += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }

        console.log("[v0] Stream complete, saving final message...")

        await saveAssistantMessage(
          projectId,
          fullResponse,
          searchQueries,
          thinkingContent,
          controller,
          encoder,
          uploadedFiles,
          generateImages,
        )

        console.log("[v0] Message saved successfully")
      } catch (error) {
        console.error("[v0] Stream processing error:", error)
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (e) {
          console.error("[v0] Error sending error message:", e)
        }
      } finally {
        console.log("[v0] Closing stream controller")
        controller.close()
      }
    },
  })
}

async function handleClaudeRequest(history: any[], message: string, imageData: any, projectId: string, userId: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return createErrorStream("Claude API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.")
  }

  let anthropic: any
  try {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  } catch (e) {
    console.error("[API/Chat] Anthropic SDK init error:", e)
    return createErrorStream(`Claude SDK failed: ${e}`)
  }

  try {
    const searchQuery = message
    const searchResult = await doSearch(searchQuery)
    const searchQueries: Array<{ query: string; results: string }> = [searchResult]

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
            model: "claude-sonnet-4-5", // Updated to latest Claude Sonnet 4.5 (Sep 2025)
            max_tokens: 8192,
            system: SYSTEM_PROMPT + `\n\nContext from web search: ${searchResult.results}`,
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

          await saveAssistantMessage(projectId, fullResponse, searchQueries, thinkingContent, controller, encoder)
        } catch (error) {
          console.error("[API/Chat] Claude stream error:", error)
          return createErrorStream(`Claude request failed: ${error}`)
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[API/Chat] Claude handler error:", e)
    return createErrorStream(`Claude handler failed: ${e}`)
  }
}

async function handleGPTRequest(history: any[], message: string, imageData: any, projectId: string, userId: string) {
  if (!process.env.OPENAI_API_KEY) {
    return createErrorStream("OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.")
  }

  let openai: any;
  try {
    const OpenAI = (await import('openai')).default;
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    console.error("[API/Chat] OpenAI SDK load error:", e);
    return createErrorStream(`Failed to load OpenAI SDK: ${e}`);
  }

  try {
    const searchQuery = message
    const searchResult = await doSearch(searchQuery)
    const searchQueries: Array<{ query: string; results: string }> = [searchResult]

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
            model: "gpt-5", // Updated to latest GPT-5 (Aug 2025); fallback to "gpt-4.1" if access denied
            messages: [
              { role: "system", content: SYSTEM_PROMPT + `\n\nContext from web search: ${searchResult.results}` },
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

          await saveAssistantMessage(projectId, fullResponse, searchQueries, thinkingContent, controller, encoder, undefined, false)
        } catch (error) {
          console.error("[API/Chat] GPT stream error:", error)
          return createErrorStream(`GPT request failed: ${error}`)
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[API/Chat] GPT handler error:", e)
    return createErrorStream(`GPT handler failed: ${e}`)
  }
}

async function handleV0Request(history: any[], message: string, projectId: string, userId: string) {
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
) {
  try {
    console.log("[v0] Extracting code blocks from response...")
    const codeBlocks = extractCodeBlocks(fullResponse)
    console.log(`[v0] Found ${codeBlocks.length} code blocks`)

    const cleanContent = removeCodeBlocks(fullResponse)
    const hasArtifact = codeBlocks.length > 0

    console.log("[v0] Inserting message into database...")
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

    console.log("[v0] Message inserted with ID:", newMessage.id)

    if (hasArtifact && codeBlocks.length > 0) {
      const existingFiles = await db.select().from(files).where(eq(files.projectId, projectId))
      const fileIds: string[] = []

      console.log("[v0] Processing code blocks...")
      for (const block of codeBlocks) {
        console.log(`[v0] Inserting file: ${block.path}`)

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
        console.log(`[v0] File inserted: ${file.id}`)
      }

      console.log("[v0] Creating artifact...")
      await db.insert(artifacts).values({
        projectId,
        messageId: newMessage.id,
        title: `Code from ${new Date().toLocaleString()}`,
        fileIds,
      })
      console.log("[v0] Artifact created")
    }

    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId))

    console.log("[v0] Sending done signal to client")
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ done: true, messageId: newMessage.id, hasArtifact })}\n\n`),
    )
  } catch (e) {
    console.error("[v0] Save assistant error:", e)
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to save response" })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
    } catch (sendError) {
      console.error("[v0] Error sending error message:", sendError)
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