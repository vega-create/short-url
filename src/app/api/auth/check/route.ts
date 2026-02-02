import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: verifyAdmin(request) })
}
