import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = `${req.headers.get('origin')}/api/github/callback`
  const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/projects'
  const state = encodeURIComponent(redirectTo) // Pass redirect path in state

  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo&state=${state}`
  return NextResponse.redirect(authorizeUrl)
}