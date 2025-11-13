import { auth } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { eq, sum, gt, desc } from 'drizzle-orm'
import { userCredits, giftEvents } from '@/config/schema'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REGEN_INTERVAL_MINUTES = 400 // How much time the user need to wait
const CREDITS_PER_INTERVAL = 3 // How much credits the user need to get
const INTERVAL_MS = REGEN_INTERVAL_MINUTES * 60 * 1000 // 60000 ms for 1 min
const UNLIMITED_CREDITS = 9999 // High number for premium display

// Helper to check if a month has passed since last monthly claim
function isMonthPassed(lastClaim: Date | null): boolean {
  if (!lastClaim) return true
  const today = new Date()
  const nextMonth = new Date(lastClaim.getFullYear(), lastClaim.getMonth() + 1, lastClaim.getDate())
  // If next month day doesn't exist (e.g., Jan 31 to Feb), adjust to last day of month
  if (nextMonth.getDate() !== lastClaim.getDate()) {
    nextMonth.setDate(0) // Last day of previous month (which is Feb in this case)
  }
  return today >= nextMonth
}

// Helper to calculate and apply regeneration without resetting timer
async function applyRegeneration(userId: string) {
  let record = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId))
    .then(r => r[0])

  if (!record) {
    // Create initial record
    await db.insert(userCredits).values({
      userId,
      credits: 10,
      lastRegenTime: new Date(),
      lastClaimedGiftId: null,
      lastMonthlyClaim: null,
      isPremium: false,
    })
    record = { 
      userId,
      credits: 10, 
      lastRegenTime: new Date(), 
      lastClaimedGiftId: null,
      lastMonthlyClaim: null, 
      isPremium: false 
    }
  }

  if (record.isPremium) {
    return { 
      credits: UNLIMITED_CREDITS, 
      secondsUntilNextRegen: 0,
      record,
      pendingMonthly: 0
    }
  }

  const nowMs = Date.now()
  const lastTimeMs = new Date(record.lastRegenTime).getTime()
  const elapsedMs = nowMs - lastTimeMs
  const fullIntervals = Math.floor(elapsedMs / INTERVAL_MS)

  let newCredits = record.credits
  let newLastTimeMs = lastTimeMs

  if (fullIntervals > 0) {
    newCredits += fullIntervals * CREDITS_PER_INTERVAL
    // Advance lastRegenTime to the start of the current interval (end of last full interval)
    newLastTimeMs = lastTimeMs + (fullIntervals * INTERVAL_MS)
    // Update db
    await db
      .update(userCredits)
      .set({ 
        credits: newCredits,
        lastRegenTime: new Date(newLastTimeMs),
      })
      .where(eq(userCredits.userId, userId))
  }

  // Calculate time left in current interval
  const timeSinceLastMs = nowMs - newLastTimeMs
  let timeLeftMs = INTERVAL_MS - timeSinceLastMs

  // If somehow negative (clock skew), reset to full interval
  if (timeLeftMs < 0) {
    timeLeftMs = INTERVAL_MS
    newLastTimeMs = nowMs
    await db
      .update(userCredits)
      .set({ lastRegenTime: new Date(nowMs) })
      .where(eq(userCredits.userId, userId))
  }

  const secondsUntilNext = Math.ceil(timeLeftMs / 1000)

  // Update record in memory
  const updatedRecord = {
    ...record,
    credits: newCredits,
    lastRegenTime: new Date(newLastTimeMs),
  }

  // Calculate pending monthly credits
  const pendingMonthly = isMonthPassed(updatedRecord.lastMonthlyClaim) ? 10 : 0

  return { 
    credits: newCredits, 
    lastRegenTime: updatedRecord.lastRegenTime,
    secondsUntilNextRegen: secondsUntilNext,
    record: updatedRecord,
    pendingMonthly
  }
}

// Helper to calculate pending gift amount
async function calculatePendingGift(userRecord: any) {
  const lastGiftId = userRecord?.lastClaimedGiftId
  let pendingGift = 0

  if (lastGiftId) {
    const lastGiftRecord = await db
      .select({ createdAt: giftEvents.createdAt })
      .from(giftEvents)
      .where(eq(giftEvents.id, lastGiftId))
      .then(r => r[0])

    if (lastGiftRecord?.createdAt) {
      const unclaimedSum = await db
        .select({ total: sum(giftEvents.amount) })
        .from(giftEvents)
        .where(gt(giftEvents.createdAt, lastGiftRecord.createdAt))
        .then(r => r[0].total ?? BigInt(0))

      pendingGift = Number(unclaimedSum)
    }
  } else {
    const totalSum = await db
      .select({ total: sum(giftEvents.amount) })
      .from(giftEvents)
      .then(r => r[0].total ?? BigInt(0))

    pendingGift = Number(totalSum)
  }

  return pendingGift
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await applyRegeneration(userId)
  const pendingGift = data.record.isPremium ? 0 : await calculatePendingGift(data.record) // No gifts for premium

  return NextResponse.json({
    credits: data.credits,
    pendingGift,
    pendingMonthly: data.pendingMonthly,
    secondsUntilNextRegen: data.secondsUntilNextRegen,
    isPremium: data.record.isPremium, // New: Return status
  })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let record = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId))
    .then(r => r[0])

  if (!record) {
    await db.insert(userCredits).values({
      userId,
      credits: 10,
      lastRegenTime: new Date(),
      lastClaimedGiftId: null,
      lastMonthlyClaim: null,
      isPremium: false,
    })
    record = { 
      userId,
      credits: 10, 
      lastRegenTime: new Date(), 
      lastClaimedGiftId: null,
      lastMonthlyClaim: null, 
      isPremium: false 
    }
  }

  if (record.isPremium) {
    // Premium: No deduction needed, always success
    return NextResponse.json({ success: true })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {}

  // Handle adding a new gift (admin action) - only non-premium
  if (body?.addGift !== undefined && typeof body.addGift === 'number' && body.addGift > 0) {
    await db.insert(giftEvents).values({
      amount: body.addGift
    })
    return NextResponse.json({ success: true, message: 'Gift event added successfully' })
  }

  // Handle claiming gift - only non-premium
  if (body?.claimGift === true) {
    const data = await applyRegeneration(userId)
    const userRecord = data.record
    const pendingGift = await calculatePendingGift(userRecord)

    if (pendingGift <= 0) {
      return NextResponse.json({ error: 'No pending gift to claim' }, { status: 400 })
    }

    // Get the latest gift event ID
    const latestGift = await db
      .select()
      .from(giftEvents)
      .orderBy(desc(giftEvents.createdAt))
      .limit(1)
      .then(r => r[0])

    if (!latestGift) {
      return NextResponse.json({ error: 'No gift events available' }, { status: 400 })
    }

    // Update credits and last claimed
    const newCredits = data.credits + pendingGift
    await db
      .update(userCredits)
      .set({ 
        credits: newCredits,
        lastClaimedGiftId: latestGift.id 
      })
      .where(eq(userCredits.userId, userId))

    return NextResponse.json({ 
      success: true, 
      claimed: pendingGift, 
      newCredits 
    })
  }

  // Handle claiming monthly credits - only non-premium
  if (body?.claimMonthly === true) {
    const data = await applyRegeneration(userId)
    const userRecord = data.record
    const isAvailable = isMonthPassed(userRecord.lastMonthlyClaim)

    if (!isAvailable) {
      return NextResponse.json({ error: 'Monthly credits not yet available' }, { status: 400 })
    }

    const newCredits = data.credits + 10
    const now = new Date()
    await db
      .update(userCredits)
      .set({ 
        credits: newCredits,
        lastMonthlyClaim: now 
      })
      .where(eq(userCredits.userId, userId))

    return NextResponse.json({ 
      success: true, 
      claimed: 10, 
      newCredits 
    })
  }

  // Default: deduct credit for message send - only non-premium
  const data = await applyRegeneration(userId)

  if (data.credits <= 0) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  await db
    .update(userCredits)
    .set({ credits: data.credits - 1 })
    .where(eq(userCredits.userId, userId))

  return NextResponse.json({ success: true })
}