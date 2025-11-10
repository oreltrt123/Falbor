import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher(["/chat(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for webhook routes (Clerk sends unauthenticated requests)
  if (req.nextUrl.pathname.startsWith('/api/webhooks')) {
    return
  }
  if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}