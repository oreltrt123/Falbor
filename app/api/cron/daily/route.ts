import { db } from "@/config/db"
import { userAutomations, projects, messages, userCredits } from "@/config/schema"
import { eq } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { generateAIAutomationPrompt, generateFollowUpPrompt } from "@/lib/common/prompts/automation-prompts"
import { calculateNextRunTime, isTimeToRun } from "@/lib/common/prompts/automation-schedule"

async function deductCredits(userId: string, amount: number) {
  await db
    .update(userCredits)
    .set({ credits: sql`${userCredits.credits} - ${amount}` })
    .where(eq(userCredits.userId, userId))
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const isTest = searchParams.get("test") === "true"
  const body = await request.json().catch(() => ({}))
  const testUserId = body.userId

  console.log(`[Cron] Starting automation run - Test mode: ${isTest}`)

  let activeUsers
  if (isTest && testUserId) {
    // Test mode: Run immediately for specified user
    const [auto] = await db
      .select()
      .from(userAutomations)
      .where(eq(userAutomations.userId, testUserId))
    
    if (auto && auto.isActive) {
      activeUsers = [auto]
      console.log(`[Cron] Test mode - Found active user: ${testUserId}`)
    } else {
      return new Response("No active settings for user", { status: 400 })
    }
  } else {
    // Production mode: Find users whose automation is scheduled to run now
    const allActive = await db
      .select()
      .from(userAutomations)
      .where(eq(userAutomations.isActive, true))
    
    activeUsers = allActive.filter(auto => auto.nextRunAt && isTimeToRun(auto.nextRunAt))
    console.log(`[Cron] Found ${activeUsers.length} active users ready to run`)
  }

  const results = []
  for (const auto of activeUsers) {
    const result = await processUser(auto.userId, auto)
    results.push(result)
  }

  return new Response(
    isTest
      ? `Test executed. Processed ${results.length} user(s).`
      : `Cron executed. Processed ${results.length} user(s).`,
    { status: 200 },
  )
}

async function processUser(userId: string, auto: any) {
  if (!auto || auto.maxMessages < 2) {
    console.log(`[Cron] Skip ${userId}: Invalid settings or maxMessages < 2`)
    return { success: false, reason: "Invalid settings" }
  }

  const [creditRecord] = await db
    .select({ credits: userCredits.credits })
    .from(userCredits)
    .where(eq(userCredits.userId, userId))

  if (!creditRecord || creditRecord.credits < auto.maxMessages) {
    console.log(`[Cron] Skip ${userId}: Insufficient credits (${creditRecord?.credits || 0} < ${auto.maxMessages})`)
    return { success: false, reason: "Low credits" }
  }

  try {
    const uniquePrompt = await generateAIAutomationPrompt(auto.selectedModel)

    const [project] = await db
      .insert(projects)
      .values({
        userId,
        title: `Daily AI Creation - ${new Date().toLocaleDateString()}`,
        selectedModel: auto.selectedModel,
        isAutomated: true,
      })
      .returning()

    console.log(`[Cron] Created project ${project.id} for ${userId}`)

    // Insert user message with AI-generated prompt
    await db.insert(messages).values({
      projectId: project.id,
      role: "user",
      content: uniquePrompt,
      isAutomated: true,
    })

    // Deduct credits upfront
    await deductCredits(userId, auto.maxMessages)
    console.log(`[Cron] Deducted ${auto.maxMessages} credits from ${userId}`)

    // Generate follow-up messages with AI
    for (let i = 0; i < auto.maxMessages; i++) {
      const prompt = i === 0 ? uniquePrompt : await generateFollowUpPrompt(i, auto.selectedModel)

      try {
        const chatRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            message: prompt,
            model: auto.selectedModel,
            isAutomated: true,
          }),
        })

        if (!chatRes.ok) {
          console.warn(`[Cron] Chat request ${i + 1} returned status ${chatRes.status} for ${userId}`)
        } else {
          console.log(`[Cron] Chat request ${i + 1} successful for ${userId}`)
        }
      } catch (err) {
        console.error(`[Cron] Chat request ${i + 1} failed for ${userId}:`, err)
      }

      // Throttle between requests
      await new Promise((r) => setTimeout(r, 1500))
    }

    const nextRun = calculateNextRunTime(auto.activatedAt || new Date())
    await db.update(userAutomations).set({ 
      lastRun: new Date(),
      nextRunAt: nextRun,
    }).where(eq(userAutomations.userId, userId))

    console.log(`[Cron] Successfully completed automation for ${userId}, next run at ${nextRun}`)
    return { success: true, projectId: project.id }
  } catch (err) {
    console.error(`[Cron] Failed to process ${userId}:`, err)
    return { success: false, reason: "Processing error", error: String(err) }
  }
}
