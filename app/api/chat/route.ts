// app/api/chat/route.ts (or wherever the POST handler is defined)
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/config/db"
import { projects, messages, files, artifacts, userCustomKnowledge, userModelConfigs } from "@/config/schema"
import { eq, asc } from "drizzle-orm"
import { SYSTEM_PROMPT } from "@/lib/common/prompts/prompt"
import { DISCUSS_SYSTEM_PROMPT } from "@/lib/common/prompts/discuss-prompt"
import { randomUUID } from "crypto"

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

const openRouterModels: Record<string, string> = {
  deepseek: "deepseek/deepseek-chat-v3.1:free",
  gptoss: "openai/gpt-oss-20b:free",
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
    model = "gemini",
    generateImages,
    discussMode = false,
    isAutomated = false, // New
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
        isAutomated, // New
      })
      .returning({ id: projects.id })
    projectId = newProject.id

    // Insert user message for new project
    await db.insert(messages).values({
      projectId,
      role: "user",
      content: message,
      isAutomated, // New
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
        isAutomated, // New
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
      isAutomated, // New
    )
  } else if (model === "claude") {
    responseStream = await handleClaudeRequest(history, message, imageData, projectId, userId, discussMode, isAutomated)
  } else if (model === "gpt") {
    responseStream = await handleGPTRequest(history, message, imageData, projectId, userId, discussMode, isAutomated)
  } else if (model === "deepseek" || model === "gptoss") {
    const fullModel = openRouterModels[model]
    responseStream = await handleOpenRouterRequest(
      history,
      message,
      imageData,
      projectId,
      userId,
      discussMode,
      fullModel,
      isAutomated,
    )
  } else if (model === "v0") {
    responseStream = await handleV0Request(history, message, imageData, projectId, userId, discussMode, isAutomated)
  } else if (model === "runware") {
    responseStream = await handleRunwareRequest(
      history,
      message,
      imageData,
      projectId,
      userId,
      discussMode,
      isAutomated,
    )
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

async function handleGeminiRequest(
  history: any[],
  message: string,
  imageData: any,
  uploadedFiles: any[],
  generateImages: boolean,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean, // New
) {
  let apiKey = process.env.GEMINI_API_KEY
  try {
    const [config] = await db.select().from(userModelConfigs).where(eq(userModelConfigs.userId, userId))
    if (config?.modelApiKeys?.gemini) {
      apiKey = config.modelApiKeys.gemini
    }
  } catch (e) {
    console.error("[Gemini] Failed to fetch custom API key:", e)
  }

  let genAI: GoogleGenerativeAI
  try {
    genAI = new GoogleGenerativeAI(apiKey!)
  } catch (e) {
    console.error("[Gemini] API key error:", e)
    return createErrorStream("Gemini API key missing or invalid")
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" })

  // 21st.dev integration via prompt (no external call needed)
  const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
  console.log(`[Gemini] UI request detected: ${isUIRequest} for message: ${message.substring(0, 50)}...`)
  const uiContext = isUIRequest
    ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
    : ""

  const customKnowledgePrompt = await getCustomKnowledge(userId)

  const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext + customKnowledgePrompt

  const conversationHistory = [
    {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
    {
      role: "model",
      parts: [
        {
          text: discussMode
            ? "Understood. I'll engage in conversation without generating code."
            : "Understood. I'll format code blocks properly with file paths.",
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
          [], // No search results
          controller,
          encoder,
          uploadedFiles,
          generateImages,
          discussMode,
          isAutomated, // New
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
  isAutomated: boolean, // New
) {
  let apiKey = process.env.ANTHROPIC_API_KEY
  try {
    const [config] = await db.select().from(userModelConfigs).where(eq(userModelConfigs.userId, userId))
    if (config?.modelApiKeys?.claude) {
      apiKey = config.modelApiKeys.claude
    }
  } catch (e) {
    console.error("[Claude] Failed to fetch custom API key:", e)
  }

  if (!apiKey) {
    return createErrorStream(
      "Claude API key not configured. Please add ANTHROPIC_API_KEY to your environment variables or add your API key in Settings.",
    )
  }

  let anthropic: any
  try {
    anthropic = new Anthropic({ apiKey })
  } catch (e) {
    console.error("[Claude] SDK init error:", e)
    return createErrorStream(`Claude SDK failed: ${e}`)
  }

  try {
    const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
    console.log(`[Claude] UI request detected: ${isUIRequest}`)
    const uiContext = isUIRequest
      ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
      : ""

    const customKnowledgePrompt = await getCustomKnowledge(userId)

    const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext + customKnowledgePrompt

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""

    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await anthropic.messages.create({
            model: "claude-sonnet-4-5", // Fixed: Use current Sonnet 4.5 alias (replaces deprecated claude-3-5-sonnet)
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
            [], // No search results
            controller,
            encoder,
            undefined,
            false,
            discussMode,
            isAutomated, // New
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
  isAutomated: boolean, // New
) {
  let apiKey = process.env.OPENAI_API_KEY
  try {
    const [config] = await db.select().from(userModelConfigs).where(eq(userModelConfigs.userId, userId))
    if (config?.modelApiKeys?.gpt) {
      apiKey = config.modelApiKeys.gpt
    }
  } catch (e) {
    console.error("[GPT] Failed to fetch custom API key:", e)
  }

  if (!apiKey) {
    return createErrorStream(
      "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables or add your API key in Settings.",
    )
  }

  let openai: any
  try {
    const OpenAI = (await import("openai")).default
    openai = new OpenAI({ apiKey })
  } catch (e) {
    console.error("[GPT] SDK load error:", e)
    return createErrorStream(`Failed to load OpenAI SDK: ${e}`)
  }

  try {
    const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
    console.log(`[GPT] UI request detected: ${isUIRequest}`)
    const uiContext = isUIRequest
      ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
      : ""

    const customKnowledgePrompt = await getCustomKnowledge(userId)

    const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext + customKnowledgePrompt

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""

    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await openai.chat.completions.create({
            model: "gpt-5", // Updated to real GPT-5 (available as of Aug 2025)
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content: message },
            ],
            stream: true,
            max_completion_tokens: 8192,
          })

          let hasResponse = false
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) {
              hasResponse = true
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              console.log(`[GPT] Chunk sent, length: ${text.length}`) // Added logging for debugging empty responses
            }
          }

          if (!hasResponse) {
            throw new Error("Empty response from GPT-5 API – check rate limits or key access")
          }

          console.log(`[GPT] Extracted code blocks: ${discussMode ? 0 : extractCodeBlocks(fullResponse).length}`)

          await saveAssistantMessage(
            projectId,
            fullResponse,
            [], // No search results
            controller,
            encoder,
            undefined,
            false,
            discussMode,
            isAutomated, // New
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

async function handleOpenRouterRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
  modelName: string,
  isAutomated: boolean, // New
) {
  let apiKey = process.env.OPENROUTER_API_KEY
  try {
    const [config] = await db.select().from(userModelConfigs).where(eq(userModelConfigs.userId, userId))

    if (modelName.includes("deepseek") && config?.modelApiKeys?.deepseek) {
      apiKey = config.modelApiKeys.deepseek
    } else if (modelName.includes("gpt-oss") && config?.modelApiKeys?.gptoss) {
      apiKey = config.modelApiKeys.gptoss
    }
  } catch (e) {
    console.error("[OpenRouter] Failed to fetch custom API key:", e)
  }

  if (!apiKey) {
    return createErrorStream(
      "OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your environment variables or add your API key in Settings.",
    )
  }

  let openai: any
  try {
    const OpenAI = (await import("openai")).default
    openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    })
  } catch (e) {
    console.error("[OpenRouter] SDK load error:", e)
    return createErrorStream(`Failed to load OpenRouter SDK: ${e}`)
  }

  try {
    const isUIRequest = !discussMode && UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
    console.log(`[OpenRouter] UI request detected: ${isUIRequest}`)
    const uiContext = isUIRequest
      ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
      : ""

    const customKnowledgePrompt = await getCustomKnowledge(userId)

    const systemPrompt = discussMode ? DISCUSS_SYSTEM_PROMPT : SYSTEM_PROMPT + uiContext + customKnowledgePrompt

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""

    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await openai.chat.completions.create({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content: message },
            ],
            stream: true,
            max_tokens: 8192,
          })

          let hasResponse = false
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) {
              hasResponse = true
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              console.log(`[OpenRouter] Chunk sent, length: ${text.length}`)
            }
          }

          if (!hasResponse) {
            throw new Error("Empty response from OpenRouter API")
          }

          console.log(`[OpenRouter] Extracted code blocks: ${discussMode ? 0 : extractCodeBlocks(fullResponse).length}`)

          await saveAssistantMessage(
            projectId,
            fullResponse,
            [], // No search results
            controller,
            encoder,
            undefined,
            false,
            discussMode,
            isAutomated, // New
          )
        } catch (error) {
          console.error("[OpenRouter] Stream error:", error)
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

async function handleV0Request(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean, // New
) {
  if (discussMode) {
    return createErrorStream(
      "Discuss mode is not supported with v0 (code generation model). Please switch to another model.",
    )
  }

  if (!process.env.V0_API_KEY) {
    return createErrorStream("v0 API key not configured. Please add V0_API_KEY to your environment variables.")
  }

  // Graceful handling: Check for Premium access early (v0 requires Premium/Team for API as of 2025)
  // If you want to enforce this, add a pre-flight check to v0's account API, but for simplicity, let the SDK error and catch below
  let openai: any
  try {
    const OpenAI = (await import("openai")).default
    openai = new OpenAI({
      apiKey: process.env.V0_API_KEY,
      baseURL: "https://api.v0.dev/v1",
    })
  } catch (e) {
    console.error("[v0] SDK load error:", e)
    return createErrorStream(`Failed to load v0 SDK: ${e}`)
  }

  try {
    const isUIRequest = UI_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword))
    console.log(`[v0] UI request detected: ${isUIRequest}`)
    const uiContext = isUIRequest
      ? "\n\nUI FOCUS: Prioritize generating dedicated component files (e.g., app/components/Hero.tsx) in 21st.dev style—ensure fenced blocks for each."
      : ""

    const customKnowledgePrompt = await getCustomKnowledge(userId)

    const systemPrompt = SYSTEM_PROMPT + uiContext + customKnowledgePrompt

    const conversationHistory = history.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    let fullResponse = ""

    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await openai.chat.completions.create({
            model: "v0-1.5-md",
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content: message },
            ],
            stream: true,
            max_tokens: 8192,
          })

          let hasResponse = false
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) {
              hasResponse = true
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              console.log(`[v0] Chunk sent, length: ${text.length}`)
            }
          }

          if (!hasResponse) {
            throw new Error("Empty response from v0 API")
          }

          console.log(`[v0] Extracted code blocks: ${extractCodeBlocks(fullResponse).length}`)

          await saveAssistantMessage(
            projectId,
            fullResponse,
            [], // No search results
            controller,
            encoder,
            undefined,
            false,
            discussMode,
            isAutomated, // New
          )
        } catch (error: any) {
          console.error("[v0] Stream error:", error)
          let errorMsg = String(error)
          // Specific handling for v0 Premium requirement
          if (errorMsg.includes("Premium or Team plan required") || errorMsg.includes("403")) {
            errorMsg =
              "v0 API requires a Premium or Team plan ($20/month). Upgrade at https://v0.dev/chat/settings/billing. Falling back to a basic response."
            // Optional: Fallback to another model like gemini here if desired
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })
  } catch (e) {
    console.error("[v0] Handler error:", e)
    return createErrorStream(`v0 handler failed: ${e}`)
  }
}

async function handleRunwareRequest(
  history: any[],
  message: string,
  imageData: any,
  projectId: string,
  userId: string,
  discussMode: boolean,
  isAutomated: boolean, // New
) {
  if (discussMode) {
    return createErrorStream("Image generation is not supported in discuss mode. Please switch to generation mode.")
  }

  if (!process.env.RUNWARE_API_KEY) {
    return createErrorStream(
      "Runware API key not configured. Please add RUNWARE_API_KEY to your environment variables.",
    )
  }

  const encoder = new TextEncoder()
  let fullResponse = ""

  return new ReadableStream({
    async start(controller) {
      try {
        // Send initial progress message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "Generating your image..." })}\n\n`))

        const taskUUID = randomUUID()
        const task = {
          taskType: "imageInference",
          taskUUID,
          positivePrompt: message,
          width: 1024,
          height: 1024,
          model: "runware:101@1",
          numberResults: 1,
          outputFormat: "JPG",
          outputType: "URL", // Use URL to avoid large payloads
          ttl: 86400, // 24 hours
        }

        const apiRes = await fetch("https://api.runware.ai/v1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RUNWARE_API_KEY}`,
          },
          body: JSON.stringify([task]),
        })

        if (!apiRes.ok) {
          throw new Error(`Runware API error: ${apiRes.status} ${apiRes.statusText}`)
        }

        const apiData = await apiRes.json()
        const imageInfo = apiData.data[0]
        if (!imageInfo || !imageInfo.imageURL) {
          throw new Error("No image URL in Runware response")
        }

        // Proxy the URL to avoid CORS/COEP issues
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        const proxiedUrl = `${baseUrl}/api/proxy-image?url=${encodeURIComponent(imageInfo.imageURL)}`

        fullResponse = `Here's your generated image based on the prompt: "${message}"\n\n![Generated Image](${proxiedUrl})`

        // Send the final response text
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fullResponse })}\n\n`))

        console.log("[Runware] Image generated successfully with proxied URL")

        await saveAssistantMessage(
          projectId,
          fullResponse,
          [], // No search results
          controller,
          encoder,
          undefined,
          false,
          discussMode,
          isAutomated, // New
        )
      } catch (error) {
        console.error("[Runware] Error:", error)
        const errorMsg = `Failed to generate image: ${String(error)}`
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errorMsg })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, projectId })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })
}

function createErrorStream(errorMsg: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      const fallbackText = errorMsg.includes("request failed")
        ? `Basic fallback mode activated due to temp issue.`
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
  controller: any,
  encoder: any,
  uploadedFiles?: any[],
  generateImages?: boolean,
  discussMode = false,
  isAutomated = false, // New
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
        isAutomated, // New
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

// Helper function to fetch custom knowledge
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
