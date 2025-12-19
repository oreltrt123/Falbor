// app/api/auth/token/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {  // FIXED: Change to GET (no body needed; Clerk session via cookies)
  try {
    const { userId } = await auth()  // Synchronous
    console.log('[Auth Token] UserId from session:', userId)  // DEBUG
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    // No getToken() needed for session-based; return userId or dummy token if Bearer fallback
    return NextResponse.json({ token: 'session-based' })  // Or actual JWT if needed
  } catch (error) {
    console.error('[Auth Token] Error:', error)
    return NextResponse.json({ token: null }, { status: 500 })
  }
}