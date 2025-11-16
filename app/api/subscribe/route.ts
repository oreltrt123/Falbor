// app/api/subscribe/route.ts (App Router format; adjust to /pages/api/subscribe.ts if using Pages Router)
// Full updated route: Reverted to direct 'payment_intent' expand for 2025-10-29.clover (direct prop exists).
// - Expand 'latest_invoice.payment_intent' (1 level deep, within limit).
// - Access latestInvoice.payment_intent directly.
// - Enhanced logging: Full paths for debug.
// - Ensures client_secret always for amount_due >0; Setup for $0.
// - No DB update here—only in /confirm.

import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userCredits } from '@/config/schema'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var missing - add to .env.local')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover', // Latest stable (Nov 2025) - direct payment_intent on Invoice
})

export async function POST(request: NextRequest) {
  // Env debug log (remove in prod)
  if (process.env.NODE_ENV === 'development') {
    console.log('=== SUBSCRIBE API ENV DEBUG ===')
    console.log('CLERK_SECRET_KEY loaded?', !!process.env.CLERK_SECRET_KEY ? `Yes (prefix: ${process.env.CLERK_SECRET_KEY?.substring(0, 10)}...)` : '❌ MISSING - Check .env.local!')
    console.log('STRIPE_SECRET_KEY loaded?', !!process.env.STRIPE_SECRET_KEY ? 'Yes' : '❌ MISSING')
    console.log('STRIPE_PRICE_ID:', process.env.STRIPE_PRICE_ID || '❌ MISSING')
    console.log('=== END DEBUG ===')
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Subscribe API: Starting for user', userId)

    // --- Fetch Clerk User ---
    let clerkUser
    try {
      console.log('Attempting currentUser fetch for user:', userId)
      clerkUser = await currentUser()
      console.log('currentUser SUCCESS - user email:', clerkUser?.emailAddresses[0]?.emailAddress)
    } catch (clerkErr: any) {
      console.error('currentUser FULL ERROR:', {
        message: clerkErr.message,
        code: clerkErr.code,
        status: clerkErr.statusCode,
        userId
      })
      return NextResponse.json(
        { error: `Clerk user fetch failed: ${clerkErr.message || 'Invalid CLERK_SECRET_KEY - verify in dashboard'}` },
        { status: 500 }
      )
    }

    if (!clerkUser) {
      return NextResponse.json(
        { error: 'No authenticated user found - re-login required' },
        { status: 401 }
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
    const records = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId))

    let record = records[0]
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
        { error: 'STRIPE_PRICE_ID missing in .env.local - Create $15/mo Price in Stripe dashboard' },
        { status: 500 }
      )
    }

    // --- Create Subscription (with direct expand for this API version) ---
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRICE_ID }],
      payment_behavior: 'default_incomplete',
      collection_method: 'charge_automatically', // Ensures PI for due amounts
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'], // FIXED: Direct expand (1 level, within limit)
    })

    console.log('Created subscription:', subscription.id, 'Status:', subscription.status)

    // --- Extract or Create Client Secret ---
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice
    let clientSecret: string | null = null
    let intentType: 'payment' | 'setup' = 'payment'

    // FIXED: Use direct path for payment_intent (exists in 2025-10-29.clover)
    const paymentIntent = (latestInvoice as any).payment_intent as Stripe.PaymentIntent | null

    console.log('Latest Invoice Debug:', {
      id: latestInvoice?.id,
      status: latestInvoice?.status,
      amount_due: latestInvoice?.amount_due,
      currency: latestInvoice?.currency,
      payment_intent_id: paymentIntent?.id || 'null', // FIXED: Direct access
    })

    if (paymentIntent && paymentIntent.client_secret) {
      // Non-trial: Use PaymentIntent
      clientSecret = paymentIntent.client_secret
      console.log('Using PaymentIntent client secret for charge')
    } else if (latestInvoice?.amount_due === 0 || subscription.status === 'trialing') {
      // Trial/$0: Create SetupIntent
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
      })
      clientSecret = setupIntent.client_secret!
      intentType = 'setup'
      console.log('Created SetupIntent for trial card collection')
    } else if (latestInvoice?.amount_due > 0 && latestInvoice?.id) {
      // Fallback: Manually create PaymentIntent for the invoice
      console.log('Fallback: Creating standalone PaymentIntent for invoice amount')
      const pi = await stripe.paymentIntents.create({
        amount: latestInvoice.amount_due,
        currency: latestInvoice.currency || 'usd',
        customer: customerId,
        payment_method_types: ['card'],
        metadata: { 
          invoice: latestInvoice.id,
          subscription: subscription.id,
        },
        setup_future_usage: 'off_session', // For recurring
      })
      clientSecret = pi.client_secret!
      intentType = 'payment'
      console.log('Fallback PaymentIntent created:', pi.id, 'Amount:', pi.amount)
    } else {
      console.warn('No valid invoice or amount - check Price ID')
      return NextResponse.json(
        { 
          error: 'Invalid subscription config - verify Price ID and amount in Stripe dashboard.',
          subscriptionId: subscription.id 
        },
        { status: 400 }
      )
    }

    console.log('Intent type:', intentType, 'Client secret present:', !!clientSecret)

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Failed to generate payment setup' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      client_secret: clientSecret,
      intentType,
      requiresPayment: !!clientSecret,
      isTrial: latestInvoice?.amount_due === 0,
      invoiceId: latestInvoice?.id, // For /confirm
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