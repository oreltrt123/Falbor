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
    console.log("Middleware: Skipping auth for:", req.nextUrl.pathname)
    return NextResponse.next()
  }

  const hostname = req.headers.get("host") || ""
  const baseDomain = process.env.NODE_ENV === "development" ? "lvh.me" : (process.env.NEXT_PUBLIC_BASE_DOMAIN || "falbor.xyz")
  const hostWithoutPort = hostname.includes(':') ? hostname.split(':')[0] : hostname

  if (hostWithoutPort.endsWith('.' + baseDomain)) {
    const subdomain = hostWithoutPort.slice(0, -(baseDomain.length + 1))
    if (subdomain && subdomain !== "www") {
      const url = req.nextUrl.clone()
      url.pathname = `/deploy/${subdomain}${url.pathname}`
      console.log("Subdomain detected:", subdomain, "-> rewriting to:", url.pathname)
      return NextResponse.rewrite(url)
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  if (process.env.NODE_ENV === "development") {
    const { userId } = await auth()
    console.log("Middleware: Auth check for", req.nextUrl.pathname, "- User:", userId || "Anonymous")
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}