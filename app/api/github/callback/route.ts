import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state') || '/chat'

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 })
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('GitHub Token Error:', tokenData)
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      )
    }

    // You can store the token here if needed
    // For now, just redirect back to your app
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL}${decodeURIComponent(state)}`

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('GitHub Callback Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
