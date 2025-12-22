import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isProtectedRoute = createRouteMatcher(["/chat(.*)"])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (
    req.nextUrl.pathname.startsWith("/api/webhooks") ||
    req.nextUrl.pathname.startsWith("/api/stripe/webhook") ||
    req.nextUrl.pathname.startsWith("/deploy/")
  ) {
    console.log("[v0] Middleware: Skipping auth for:", req.nextUrl.pathname)
    return NextResponse.next()
  }

  const hostname = req.headers.get("host") || ""
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "falbor.xyz"

  if (process.env.NODE_ENV === "production" && hostname.includes(".")) {
    const subdomain = hostname.split(".")[0]

    // Skip if it's www or the base domain itself
    if (subdomain !== "www" && hostname !== baseDomain) {
      // Rewrite to /deploy/[subdomain]
      const url = req.nextUrl.clone()
      url.pathname = `/deploy/${subdomain}${url.pathname}`

      console.log("[v0] Subdomain detected:", subdomain, "-> rewriting to:", url.pathname)
      return NextResponse.rewrite(url)
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  if (process.env.NODE_ENV === "development") {
    const { userId } = await auth()
    console.log("[v0] Middleware: Auth check for", req.nextUrl.pathname, "- User:", userId || "Anonymous")
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
