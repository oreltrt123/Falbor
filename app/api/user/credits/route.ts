import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { eq, sum, gt, desc, sql } from 'drizzle-orm'
import { userCredits, giftEvents } from '@/config/schema'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REGEN_INTERVAL_MINUTES = 400 // How much time the user need to wait
const CREDITS_PER_INTERVAL = 3 // How much credits the user need to get
const INTERVAL_MS = REGEN_INTERVAL_MINUTES * 60 * 1000 // 60000 ms for 1 min

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

async function getPayPalAccessToken() {
  const response = await fetch('https://api.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function isSubscriptionActive(subscriptionId: string | null): Promise<boolean> {
  if (!subscriptionId) return false;

  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`https://api.paypal.com/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'ACTIVE';
  } catch (error) {
    console.error('Error checking PayPal subscription status:', error);
    return false;
  }
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
      lastDispense: null,
      subscriptionTier: 'none',
      creditsPerMonth: 0,
      paypalSubscriptionId: null,
      stripeCustomerId: null,
    })
    record = { 
      userId,
      credits: 10, 
      lastRegenTime: new Date(), 
      lastClaimedGiftId: null,
      lastMonthlyClaim: null, 
      lastDispense: null,
      subscriptionTier: 'none',
      creditsPerMonth: 0,
      paypalSubscriptionId: null,
      stripeCustomerId: null,
    }
  }

  const now = new Date()
  const nowMs = now.getTime()
  const isPaid = record.subscriptionTier !== 'none' && record.paypalSubscriptionId !== null

  if (isPaid) {
    // Check subscription status
    const active = await isSubscriptionActive(record.paypalSubscriptionId);
    if (!active) {
      // Deactivate if not active
      await db
        .update(userCredits)
        .set({ 
          subscriptionTier: 'none',
          creditsPerMonth: 0,
          paypalSubscriptionId: null,
        })
        .where(eq(userCredits.userId, userId));
      // Recurse with free logic
      return applyRegeneration(userId);
    }

    // Premium logic: Monthly credits
    let newCredits = record.credits
    let lastDispense = record.lastDispense
    let secondsUntilNextRegen = 0

    if (!lastDispense || isMonthPassed(lastDispense)) {
      newCredits += record.creditsPerMonth
      lastDispense = now
      // Update DB
      await db
        .update(userCredits)
        .set({ 
          credits: newCredits,
          lastDispense: now,
        })
        .where(eq(userCredits.userId, userId))
    } else {
      // Calculate time to next month
      const nextMonth = new Date(lastDispense.getFullYear(), lastDispense.getMonth() + 1, lastDispense.getDate())
      if (nextMonth.getDate() !== lastDispense.getDate()) {
        nextMonth.setDate(0)
      }
      const timeLeftMs = nextMonth.getTime() - nowMs
      secondsUntilNextRegen = Math.max(0, Math.ceil(timeLeftMs / 1000))
    }

    const updatedRecord = {
      ...record,
      credits: newCredits,
      lastDispense: lastDispense,
    }

    return { 
      credits: newCredits, 
      secondsUntilNextRegen,
      record: updatedRecord,
      pendingMonthly: 0 // No pending for paid
    }
  } else {
    // Non-paid: Hourly regen
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
  const pendingGift = data.record.subscriptionTier === 'none' ? await calculatePendingGift(data.record) : 0 // No gifts for paid

  return NextResponse.json({
    credits: data.credits,
    pendingGift,
    pendingMonthly: data.pendingMonthly,
    secondsUntilNextRegen: data.secondsUntilNextRegen,
    subscriptionTier: data.record.subscriptionTier,
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
      lastDispense: null,
      subscriptionTier: 'none',
      creditsPerMonth: 0,
      paypalSubscriptionId: null,
      stripeCustomerId: null,
    })
    record = { 
      userId,
      credits: 10, 
      lastRegenTime: new Date(), 
      lastClaimedGiftId: null,
      lastMonthlyClaim: null, 
      lastDispense: null,
      subscriptionTier: 'none',
      creditsPerMonth: 0,
      paypalSubscriptionId: null,
      stripeCustomerId: null,
    }
  }

  const isPaid = record.subscriptionTier !== 'none' && record.paypalSubscriptionId !== null

  let body: any = null
  try {
    body = await request.json()
  } catch {}

  // Handle adding a new gift (admin action) - only non-paid
  if (body?.addGift !== undefined && typeof body.addGift === 'number' && body.addGift > 0 && !isPaid) {
    await db.insert(giftEvents).values({
      amount: body.addGift
    })
    return NextResponse.json({ success: true, message: 'Gift event added successfully' })
  }

  // Handle claiming gift - only non-paid
  if (body?.claimGift === true && !isPaid) {
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

  // Handle claiming monthly credits - only non-paid
  if (body?.claimMonthly === true && !isPaid) {
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

  // Handle one-time payment for credits or tier
  if (body?.orderId && body?.credits) {
    const data = await applyRegeneration(userId);
    const added = Number(body.credits);
    if (isNaN(added) || added <= 0) {
      return NextResponse.json({ error: 'Invalid credits amount' }, { status: 400 });
    }
    let updates: any = { credits: data.credits + added };
    if (body.tier && data.record.subscriptionTier === 'none') {
      updates.subscriptionTier = body.tier;
      updates.creditsPerMonth = 0;
    }
    await db
      .update(userCredits)
      .set(updates)
      .where(eq(userCredits.userId, userId));
    return NextResponse.json({ success: true, newCredits: data.credits + added });
  }

  // Default: deduct credit for message send
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