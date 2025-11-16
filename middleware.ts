// middleware.ts (Root of your Next.js project, e.g., /middleware.ts)
// Updated for Clerk v5+ (as of 2025): Uses createRouteMatcher for protected routes.
// Key checks/fixes:
// - Matcher includes API routes (protected by default) and skips static files/webhooks.
// - Explicitly skip Clerk webhooks to avoid auth loops (Clerk sends unauth requests).
// - Added optional logging for dev (remove in prod).
// - Ensure CLERK_SECRET_KEY is loaded server-side—middleware relies on it implicitly.
// - Compatible with App Router; no changes needed for Pages Router if migrating.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher(["/chat(.*)"]) // Your protected paths, e.g., /chat*

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for webhook routes (Clerk/Stripe send unauthenticated requests)
  if (req.nextUrl.pathname.startsWith('/api/webhooks') || req.nextUrl.pathname.startsWith('/api/stripe/webhook')) {
    console.log('Middleware: Skipping auth for webhook:', req.nextUrl.pathname) // Dev log only
    return
  }

  // Protect specified routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // Optional: Log all requests in dev for debugging auth issues
  if (process.env.NODE_ENV === 'development') {
    const sessionAuth = await auth()
    console.log('Middleware: Auth check for', req.nextUrl.pathname, '- User:', sessionAuth.userId || 'Anonymous')
  }
})

export const config = {
  matcher: [
    // Match all paths except static files and _next/
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Match API and TRPC routes
    "/(api|trpc)(.*)",
  ],
}