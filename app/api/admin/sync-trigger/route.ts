import { NextRequest, NextResponse } from 'next/server'

// Server-side proxy for sync triggers — keeps SYNC_SECRET_KEY out of client bundle
export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_SECRET_KEY
  if (!secret) return NextResponse.json({ success: false, error: 'Sync not configured' }, { status: 500 })

  const { action } = await request.json().catch(() => ({ action: 'full' }))

  const endpointMap: Record<string, string> = {
    full: '/api/sync',
    inventory: '/api/sync/inventory',
    categories: '/api/sync/categories',
    images: '/api/sync/images',
  }

  const endpoint = endpointMap[action] || '/api/sync'
  const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${request.headers.get('host')}`

  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()
  return NextResponse.json(data)
}

export async function GET(request: NextRequest) {
  const secret = process.env.SYNC_SECRET_KEY
  if (!secret) return NextResponse.json({ success: false, error: 'Sync not configured' }, { status: 500 })

  const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${request.headers.get('host')}`

  const response = await fetch(`${base}/api/sync/images`, {
    headers: { 'Authorization': `Bearer ${secret}` },
  })

  const data = await response.json()
  return NextResponse.json(data)
}
