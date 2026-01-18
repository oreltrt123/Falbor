import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.headers.get('origin') ||
    'https://falbor.xyz'

  const redirectUri = `${siteUrl}/api/github/callback`

  const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/chat'
  const state = encodeURIComponent(redirectTo)

  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=repo&state=${state}`

  return NextResponse.redirect(authorizeUrl)
}
