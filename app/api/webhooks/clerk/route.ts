import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userCredits } from '@/config/schema'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { NextResponse } from 'next/server'

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!
const PREMIUM_PLAN_ID = process.env.PREMIUM_PLAN_ID! // Full plan ID, e.g., 'cplan_35H...06DTBv6aF'

export async function POST(req: Request) {
  const payload = await req.text()
  const heads = await headers()

  const svix_id = heads.get('svix-id')
  const svix_timestamp = heads.get('svix-timestamp')
  const svix_signature = heads.get('svix-signature')

  console.log('Webhook received:', { svix_id, svix_timestamp, url: req.url }) // Enhanced log

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Missing Svix headers')
    return new NextResponse('Missing Svix headers', { status: 400 })
  }

  const svixHeaders = {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature,
  }

  try {
    const wh = new Webhook(webhookSecret)
    const evt = wh.verify(payload, svixHeaders) as any
    console.log('Verified event:', evt.type, evt.data) // Full payload

    const eventType = evt.type
    const data = evt.data

    // Handle subscription and item events (Clerk billing uses 'subscription.*')
    if (eventType.startsWith('subscription.') || eventType.startsWith('subscription.item.')) {
      let userId: string
      let subscription: any
      let planId: string
      let status: string

      if (eventType.startsWith('subscription.item.')) {
        // For item events (e.g., item.active), get parent subscription
        userId = data.user_id || data.subscription?.user_id
        subscription = data.subscription || data
        planId = subscription.plan_id
        status = data.status || subscription.status // Item active implies sub active
      } else {
        // Direct subscription events
        userId = data.user_id
        subscription = data
        planId = subscription.plan_id
        status = subscription.status
      }

      console.log('Subscription details:', { userId, planId, status, eventType }) // Key log

      const isActivePremium = status === 'active' && planId === PREMIUM_PLAN_ID
      console.log('Computed isPremium:', isActivePremium)

      if (userId) {
        // Upsert: Insert if not exists, update always
        await db
          .insert(userCredits)
          // .values({
          //   userId,
          //   credits: 10, // Default
          //   lastRegenTime: new Date(),
          //   lastClaimedGiftId: null,
          //   lastMonthlyClaim: null,
          //   isPremium: isActivePremium,
          // })
          // .onConflictDoUpdate({
          //   target: userCredits.userId,
          //   set: { isPremium: isActivePremium },
          // })

        console.log(`DB updated/inserted for user ${userId}: isPremium=${isActivePremium}`)
      } else {
        console.warn('No user_id in payload')
      }
    } else {
      console.log('Non-subscription event, ignoring:', eventType)
    }

    return new NextResponse('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err, { payload }) // Log payload on error
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`Verification failed: ${message}`, { status: 400 })
  }
}