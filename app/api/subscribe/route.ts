import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userCredits } from '@/config/schema'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var missing - add to .env.local')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Subscribe API: Starting for user', userId)

    // --- Fetch Clerk User ---
    let clerkUser
    try {
      const clerk = await clerkClient() // Clerk v4 fix
      clerkUser = await clerk.users.getUser(userId)
    } catch (clerkErr) {
      console.error('Clerk fetch error:', clerkErr)
      return NextResponse.json(
        { error: 'Clerk user fetch failed - check CLERK_SECRET_KEY' },
        { status: 500 }
      )
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json(
        { error: 'User email not found in Clerk - add primary email in dashboard' },
        { status: 400 }
      )
    }

    // --- Get/Create Stripe Customer ---
    let record = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .then(r => r[0])

    let customerId = record?.stripeCustomerId
    let customer

    if (customerId) {
      customer = await stripe.customers.retrieve(customerId)
      console.log('Retrieved existing customer:', customerId)
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { clerkUserId: userId },
      })

      customerId = customer.id
      console.log('Created new customer:', customerId)

      if (record) {
        await db
          .update(userCredits)
          .set({ stripeCustomerId: customerId })
          .where(eq(userCredits.userId, userId))
      } else {
        await db.insert(userCredits).values({
          userId,
          credits: 10,
          lastRegenTime: new Date(),
          lastClaimedGiftId: null,
          lastMonthlyClaim: null,
          isPremium: false,
          lastPremiumDispense: null,
          stripeCustomerId: customerId,
        })
      }
    }

    // --- Validate Price ID ---
    const PRICE_ID = process.env.STRIPE_PRICE_ID
    if (!PRICE_ID) {
      return NextResponse.json(
        { error: 'STRIPE_PRICE_ID missing in .env.local' },
        { status: 500 }
      )
    }

    // --- Create Subscription ---
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRICE_ID }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    })

    // --- Extract PaymentIntent Client Secret (TypeScript-proof) ---
    const latestInvoice = subscription.latest_invoice
    let clientSecret: string | null = null

    if (
      latestInvoice &&
      typeof latestInvoice === 'object' &&
      'payment_intent' in latestInvoice
    ) {
      const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent

      if (paymentIntent && typeof paymentIntent === 'object') {
        clientSecret = paymentIntent.client_secret ?? null
      }
    }

    console.log('Created subscription:', subscription.id, 'Client secret:', clientSecret)

    return NextResponse.json({
      subscriptionId: subscription.id,
      client_secret: clientSecret,
    })
  } catch (error: any) {
    console.error(
      'Subscribe API Full Error:',
      error.message,
      error.stack
    )
    return NextResponse.json(
      { error: error.message || 'Internal server error - see logs' },
      { status: 500 }
    )
  }
}
