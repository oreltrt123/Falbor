import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userCredits } from '@/config/schema'

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing Stripe env vars')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {})
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Helper to check if a month has passed
function isMonthPassed(lastClaim: Date | null): boolean {
  if (!lastClaim) return true
  const today = new Date()
  let nextMonth = new Date(lastClaim.getFullYear(), lastClaim.getMonth() + 1, lastClaim.getDate())

  // Handle month length differences
  if (nextMonth.getDate() !== lastClaim.getDate()) {
    nextMonth.setDate(0) // Last day of previous month
  }

  return today >= nextMonth
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  try {
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      console.log('Webhook: Payment succeeded for invoice', invoice.id)

      // Retrieve customer to get Clerk user ID
      const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer & {
        metadata: { clerkUserId?: string }
      }
      const userId = customer.metadata.clerkUserId

      if (!userId) {
        console.warn('Webhook: No Clerk user ID in metadata for customer', customerId)
        return NextResponse.json({ received: true })
      }

      // Get user credits record
      const record = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .then(r => r[0])

      if (!record) {
        console.warn('Webhook: No credits record for user', userId)
        return NextResponse.json({ received: true })
      }

      // Set premium if not already
      if (!record) {
        await db
          .update(userCredits)
          .set({})
          .where(eq(userCredits.userId, userId))
        console.log('Webhook: Set premium for user', userId)
      }

      // Dispense/add 40 credits if a month has passed
      const lastDispense = record
      if (!lastDispense) {
        await db
          .update(userCredits)
          .set({
          })
          .where(eq(userCredits.userId, userId))
        console.log(`Webhook: Dispensed 40 credits to premium user ${userId}`)
      } else {
        console.log('Webhook: No monthly dispense needed for user', userId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handling error:', err.message)
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 400 })
  }
}
