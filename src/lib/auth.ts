import { NextRequest, NextResponse } from 'next/server'
import { getAdminPassword } from './env'

// 簡易認證：檢查 cookie 中的 admin token
// ADMIN_PASSWORD 沒設定時一律視為未授權（避免 undefined === undefined 放行）
export function verifyAdmin(request: NextRequest): boolean {
  const expected = getAdminPassword()
  if (!expected) return false
  const token = request.cookies.get('admin_token')?.value
  return token === expected
}

// API 認證包裝器
export function withAuth(
  handler: (request: NextRequest, context: unknown) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: unknown) => {
    if (!verifyAdmin(request)) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }
    return handler(request, context)
  }
}
