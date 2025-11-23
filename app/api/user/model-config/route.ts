import { db } from "@/config/db"
import { userModelConfigs } from "@/config/schema"
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    let config = await db
      .select()
      .from(userModelConfigs)
      .where(eq(userModelConfigs.userId, userId))
      .then((r) => r[0])

    if (!config) {
      // Create default config
      config = await db
        .insert(userModelConfigs)
        .values({
          userId,
          enabledModels: ["gemini", "claude", "gpt", "deepseek", "gptoss", "runware"],
          modelApiKeys: {},
        })
        .returning()
        .then((r) => r[0])
    }

    return new Response(
      JSON.stringify({
        enabledModels: config.enabledModels,
        modelApiKeys: config.modelApiKeys || {},
      }),
      { status: 200 },
    )
  } catch (error) {
    console.error("[API/model-config] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch config" }), { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const body = await request.json()
    const { enabledModels, modelApiKeys } = body

    await db
      .insert(userModelConfigs)
      .values({
        userId,
        enabledModels: enabledModels || ["gemini", "claude", "gpt", "deepseek", "gptoss", "runware"],
        modelApiKeys: modelApiKeys || {},
      })
      .onConflictDoUpdate({
        target: userModelConfigs.userId,
        set: {
          enabledModels: enabledModels,
          modelApiKeys: modelApiKeys,
          updatedAt: new Date(),
        },
      })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[API/model-config] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to update config" }), { status: 500 })
  }
}
