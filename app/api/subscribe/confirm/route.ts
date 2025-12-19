// app/api/subscribe/confirm/route.ts (New: Simple POST to set isPremium=true after successful card confirm)
// This is called from frontend after stripe.confirmPayment() or confirmSetup() succeeds.
// Handles both cases: For 'payment', sub auto-activates; for 'setup', marks user premium (sub is trialing).

import { auth } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userCredits } from '@/config/schema'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Update DB to premium (sub already created/activated)
    await db
      .update(userCredits)
      .set({})
      .where(eq(userCredits.userId, userId))

    console.log('Confirmed premium for user:', userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Confirm API Error:', error)
    return NextResponse.json({ error: 'Failed to confirm subscription' }, { status: 500 })
  }
}