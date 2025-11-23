import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return new NextResponse('Missing URL parameter', { status: 400 })
  }

  try {
    const response = await fetch(decodeURIComponent(imageUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FalborProxy/1.0)',
      },
    })

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Embedder-Policy': 'require-corp', // Allow embedding
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    })
  } catch (error) {
    console.error('[Proxy Image] Fetch error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}