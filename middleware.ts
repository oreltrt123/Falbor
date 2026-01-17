import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isProtectedRoute = createRouteMatcher(["/chat(.*)"])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  // 1. Skip auth & rewrites for special routes
  if (
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/deploy/")
  ) {
    return NextResponse.next()
  }

  // 2. Detect subdomain
  const hostname = req.headers.get("host") || ""
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "falbor.app"

  /**
   * Examples:
   * eccf34b9.falbor.app  -> subdomain = eccf34b9
   * www.falbor.app      -> ignore
   * falbor.app          -> ignore
   */
  const isSubdomain =
    hostname.endsWith(`.${baseDomain}`) &&
    !hostname.startsWith("www.") &&
    hostname !== baseDomain

  if (process.env.NODE_ENV === "production" && isSubdomain) {
    const subdomain = hostname.replace(`.${baseDomain}`, "")

    const url = req.nextUrl.clone()
    url.pathname = `/deploy/${subdomain}${pathname}`

    console.log("Rewriting subdomain:", hostname, "->", url.pathname)

    return NextResponse.rewrite(url)
  }

  // 3. Protect private routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
