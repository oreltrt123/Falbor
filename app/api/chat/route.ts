import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "@/config/db"
import { projects, messages, files, artifacts, userCustomKnowledge } from "@/config/schema"
import { eq, asc } from "drizzle-orm"
import { SYSTEM_PROMPT } from "@/lib/common/prompts/prompt"
import { DISCUSS_SYSTEM_PROMPT } from "@/lib/common/prompts/discuss-prompt"

const GREETING_KEYWORDS = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"]
const QUESTION_KEYWORDS = ["what is", "who is", "where is", "when is", "why is", "how does", "explain", "tell me about"]

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

const OPENROUTER_MODELS = {
  "gpt-5.2": "openai/gpt-5.2",
  "gpt-5.1-codex": "openai/gpt-5.1-codex-max",
  "claude-opus-4.5": "anthropic/claude-opus-4.5",
  "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
  "claude-opus-4": "anthropic/claude-opus-4",
  "grok-4.1": "x-ai/grok-4.1-fast",
  "claude-3.5-haiku": "anthropic/claude-3.5-haiku",
  "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
  "grok-3-mini": "x-ai/grok-3-mini",
}

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
    selectedModel = "gemini",
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
        selectedModel: selectedModel || "gemini",
        isAutomated,
      })
      .returning({ id: projects.id })
    projectId = newProject.id
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

  let history: any[]
  try {
    history =
      (await db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.createdAt))) ?? []
  } catch (e) {
    console.error("[API/Chat] History fetch error:", e)
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 })
  }

  const lastMsg = history[history.length - 1]
  if (history.length === 0 || !(lastMsg?.role === "user" && lastMsg.content === message)) {
    try {
      await db.insert(messages).values({
        projectId,
        role: "user",
        content: message,
        isAutomated,
      })
      history.push({ role: "user", content: message })
    } catch (e) {
      console.error("[API/Chat] User insert error:", e)
      return new Response(JSON.stringify({ error: "Failed to save message" }), { status: 500 })
    }
  } else {
    console.log("[API/Chat] Skipping duplicate user message insert")
  }

  const responseStream = await handleModelRequest(
    history,
    message,
    imageData,
    projectId,
    userId,
    discussMode,
    isAutomated,
    selectedModel,
  )

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function detectMessageType(message: string): "greeting" | "question" | "build" {
  const lowerMessage = message.toLowerCase().trim()

  // Check if it's a simple greeting (short and matches greeting keywords)
  if (lowerMessage.length < 50 && GREETING_KEYWORDS.some((kw) => lowerMessage.includes(kw))) {
    return "greeting"
  }

  // Check if it's a question
  if (
    QUESTION_KEYWORDS.some((kw) => lowerMessage.includes(kw)) &&
    !CODE_KEYWORDS.some((kw) => lowerMessage.includes(kw))
  ) {
    return "question"
  }

  // Default to build request
  return "build"
}

async function handleModelRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean,
  selectedModel: string,
) {
  const messageType = detectMessageType(message)
  const isCodeRequest =
    messageType === "build" || CODE_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))

  console.log(
    `[${selectedModel}] Message type: ${messageType}, Code request: ${isCodeRequest} for: "${message.substring(0, 50)}..."`,
  )

  if (selectedModel === "gemini") {
    return handleGeminiRequest(
      history,
      message,
      imageData,
      projectId,
      userId,
      discussMode,
      isAutomated,
      isCodeRequest,
      messageType,
    )
  } else {
    return handleOpenRouterRequest(
      history,
      message,
      projectId,
      userId,
      discussMode,
      isAutomated,
      isCodeRequest,
      selectedModel,
      messageType,
    )
  }
}

async function handleGeminiRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean,
  isCodeRequest: boolean,
  messageType: "greeting" | "question" | "build",
) {
  const googleKey = process.env.GOOGLE_API_KEY

  if (!googleKey) {
    return createErrorStream("Google API key not configured.")
  }

  let genAI: any
  try {
    genAI = new GoogleGenerativeAI(googleKey)
  } catch (e) {
    console.error("[Gemini] SDK init error:", e)
    return createErrorStream(`Failed to initialize Gemini: ${e}`)
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
    let fullResponse = ""
    let accumulatedBuffer = ""
    let inCodeBlock = false

    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 8192 },
    })

    return new ReadableStream({
      async start(controller) {
        try {
          let userPrompt = message

          if (messageType === "greeting") {
            console.log("[Gemini] Simple greeting response")
            userPrompt = `${message}\n\nRespond naturally and briefly like a friendly human. No thinking tags, no code, just a warm greeting back.`
          } else if (messageType === "question") {
            console.log("[Gemini] Question with thinking and search")
            userPrompt = `${message}\n\nThink through this question step by step inside <Thinking> tags. Search for current information if needed inside <Search> tags. Then provide a clear, detailed answer in plain text. No code generation.`
          } else if (isCodeRequest) {
            console.log("[Gemini] Responding to build request with dynamic flow")
            userPrompt = `${message}\n\nIMPORTANT: Respond with ORGANIC, DYNAMIC thinking process:
            
1. Think multiple times throughout your response (not just once at the start)
2. Search for information as you need it during planning
3. Read and analyze in a natural, messy order
4. Your response should show: Think → partial answer → Search → Think again → Read → Plan → Think → Write code
5. Make it feel like natural problem-solving, not a rigid template

Use these tags organically throughout:
- <Thinking>your reasoning</Thinking> - Use MULTIPLE times
- <Search>search query and results</Search> - Use when you need info
- <UserMessage>understanding</UserMessage> - Once at start
- <Planning>file list</Planning> - Once when ready
- <FileChecks>validation</FileChecks> - If needed
- Response text - Your explanation
- Code blocks - The actual files

Then generate production-ready code files.`
          } else {
            console.log("[Gemini] Using Gemini for conversational response")
          }

          const contents = [...mapHistoryToGemini(conversationHistory), { role: "user", parts: [{ text: userPrompt }] }]

          let continuationCount = 0
          do {
            const stream = await geminiModel.generateContentStream({
              contents,
            })

            let finishReason = null
            for await (const chunk of stream.stream) {
              const part = chunk.candidates?.[0]?.content?.parts?.[0]
              if (part?.text) {
                fullResponse += part.text

                if (isCodeRequest && messageType === "build") {
                  accumulatedBuffer += part.text
                  const lines = accumulatedBuffer.split("\n")
                  let textToSend = ""

                  for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i]

                    if (line.match(/^```\w+\s+file="/)) {
                      inCodeBlock = true
                      continue
                    }

                    if (line.trim() === "```" && inCodeBlock) {
                      inCodeBlock = false
                      continue
                    }

                    if (!inCodeBlock) {
                      textToSend += line + "\n"
                    }
                  }

                  accumulatedBuffer = lines[lines.length - 1]

                  if (textToSend) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: textToSend })}\n\n`))
                  }
                } else {
                  // For greetings and questions, stream everything
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`))
                }
              }
              if (chunk.candidates?.[0]?.finishReason) {
                finishReason = chunk.candidates[0].finishReason
              }
            }

            if (finishReason === "MAX_TOKENS" && continuationCount < maxContinuations) {
              continuationCount++
              contents.push({ role: "model", parts: [{ text: fullResponse }] })
              contents.push({ role: "user", parts: [{ text: continueMessage }] })
            } else {
              break
            }
          } while (true)

          console.log(`[Gemini] Response length: ${fullResponse.length}`)

          if (messageType === "build" && isCodeRequest) {
            await saveAssistantMessageWithParallelGeneration(
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
          } else {
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
          console.error("[Gemini] Stream error:", error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[Gemini] Handler error:", e)
    return createErrorStream(`Gemini handler failed: ${e}`)
  }
}

function mapHistoryToGemini(history: any[]) {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }))
}

async function handleOpenRouterRequest(
  history: any[],
  message: string,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean,
  isCodeRequest: boolean,
  selectedModel: string,
  messageType: "greeting" | "question" | "build",
) {
  const openRouterKey = process.env.OPENROUTER_API_KEY

  if (!openRouterKey) {
    return createErrorStream("OpenRouter API key not configured.")
  }

  const modelId = OPENROUTER_MODELS[selectedModel as keyof typeof OPENROUTER_MODELS]
  if (!modelId) {
    return createErrorStream(`Invalid model: ${selectedModel}`)
  }

  try {
    const customKnowledgePrompt = await getCustomKnowledge(userId)
    const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + customKnowledgePrompt

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""
    let accumulatedBuffer = ""
    let inCodeBlock = false

    let userPrompt = message

    if (messageType === "greeting") {
      userPrompt = `${message}\n\nRespond naturally and briefly like a friendly human. No thinking tags, no code, just a warm greeting back.`
    } else if (messageType === "question") {
      userPrompt = `${message}\n\nThink through this question step by step. Search for current information if needed. Then provide a clear, detailed answer. No code generation.`
    } else if (isCodeRequest) {
      console.log(`[OpenRouter/${modelId}] Using for code generation with dynamic flow`)
      userPrompt = `${message}\n\nRespond with ORGANIC, DYNAMIC thinking - think, search, read, plan multiple times throughout naturally. Then generate clean code files.`
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userPrompt },
    ]

    return new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openRouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
              "X-Title": "AI Website Builder",
            },
            body: JSON.stringify({
              model: modelId,
              messages,
              stream: true,
              max_tokens: 8192,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
          }

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error("No response body reader")
          }

          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data === "[DONE]") continue

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    fullResponse += content

                    if (isCodeRequest && messageType === "build") {
                      accumulatedBuffer += content
                      const lines = accumulatedBuffer.split("\n")
                      let textToSend = ""

                      for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i]

                        if (line.match(/^```\w+\s+file="/)) {
                          inCodeBlock = true
                          continue
                        }

                        if (line.trim() === "```" && inCodeBlock) {
                          inCodeBlock = false
                          continue
                        }

                        if (!inCodeBlock) {
                          textToSend += line + "\n"
                        }
                      }

                      accumulatedBuffer = lines[lines.length - 1]

                      if (textToSend) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: textToSend })}\n\n`))
                      }
                    } else {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`))
                    }
                  }
                } catch (e) {
                  console.error("[OpenRouter] Parse error:", e)
                }
              }
            }
          }

          console.log(`[OpenRouter/${modelId}] Response length: ${fullResponse.length}`)

          if (messageType === "build" && isCodeRequest) {
            await saveAssistantMessageWithParallelGeneration(
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
          } else {
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
          console.error(`[OpenRouter/${modelId}] Stream error:`, error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[OpenRouter] Handler error:", e)
    return createErrorStream(`OpenRouter handler failed: ${e}`)
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
  }
}

async function saveAssistantMessageWithParallelGeneration(
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
    console.log("[ParallelGen] Extracting code blocks from response...")
    const codeBlocks = discussMode ? [] : extractCodeBlocks(fullResponse)
    console.log(
      `[ParallelGen] Found ${codeBlocks.length} code blocks - splitting into ${codeBlocks.length} parallel workers`,
    )

    const cleanContent = discussMode ? fullResponse.trim() : removeCodeBlocks(fullResponse)
    const hasArtifact = codeBlocks.length > 0 && !discussMode

    console.log("[ParallelGen] Inserting message into database...")
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

    console.log("[ParallelGen] Message inserted with ID:", newMessage.id)

    if (hasArtifact && codeBlocks.length > 0) {
      const existingFiles = await db.select().from(files).where(eq(files.projectId, projectId))

      console.log(`[ParallelGen] 🚀 Launching ${codeBlocks.length} parallel workers...`)
      const startTime = Date.now()

      const filePromises = codeBlocks.map(async (block, index) => {
        console.log(`[Worker ${index + 1}] Starting work on: ${block.path}`)

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

        console.log(`[Worker ${index + 1}] ✅ Completed: ${block.path} (${file.id})`)
        return file.id
      })

      // Execute all file insertions in parallel
      const fileIds = await Promise.all(filePromises)

      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)
      console.log(`[ParallelGen] 🎉 All ${codeBlocks.length} workers completed in ${duration}s (parallel execution!)`)

      console.log("[ParallelGen] Creating artifact...")
      await db.insert(artifacts).values({
        projectId,
        messageId: newMessage.id,
        title: `Code from ${new Date().toLocaleString()} (Generated in ${duration}s)`,
        fileIds,
      })
      console.log("[ParallelGen] Artifact created")
    }

    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId))

    console.log("[ParallelGen] Sending done signal to client")
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ done: true, messageId: newMessage.id, hasArtifact, projectId })}\n\n`),
    )
  } catch (e) {
    console.error("[ParallelGen] Error:", e)
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to save response" })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
    } catch (sendError) {
      console.error("[ParallelGen] Error sending error message:", sendError)
    }
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