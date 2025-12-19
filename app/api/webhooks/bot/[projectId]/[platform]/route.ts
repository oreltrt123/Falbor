import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/config/db"
import { bot_deployments } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ projectId: string; platform: string }>
  },
) {
  try {
    const { projectId, platform } = await params
    const body = await request.json()

    console.log(`[v0] Webhook received for ${platform}:`, JSON.stringify(body, null, 2))

    // Get deployment to verify it exists and is active
    const deployment = await db.query.bot_deployments.findFirst({
      where: and(eq(bot_deployments.projectId, projectId as any), eq(bot_deployments.platform, platform)),
    })

    if (!deployment || !deployment.isActive) {
      return NextResponse.json({ error: "Bot not found or inactive" }, { status: 404 })
    }

    // Route to appropriate handler
    if (platform === "discord") {
      return await handleDiscordWebhook(body, projectId, deployment)
    } else if (platform === "whatsapp") {
      return await handleWhatsAppWebhook(body, projectId, deployment)
    }

    return NextResponse.json({ error: "Unknown platform" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handleDiscordWebhook(body: any, projectId: string, deployment: any) {
  // Discord interaction handling
  // This would typically:
  // 1. Verify the request signature
  // 2. Parse the message/command
  // 3. Run bot inference
  // 4. Send response back to Discord

  console.log("[v0] Discord webhook processed")
  return NextResponse.json({ handled: true })
}

async function handleWhatsAppWebhook(body: any, projectId: string, deployment: any) {
  // WhatsApp message handling
  // This would typically:
  // 1. Extract the incoming message
  // 2. Run bot inference
  // 3. Send response back via WhatsApp API

  console.log("[v0] WhatsApp webhook processed")
  return NextResponse.json({ handled: true })
}
