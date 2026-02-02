import { NextRequest, NextResponse } from 'next/server'

// 簡易認證：檢查 cookie 中的 admin token
export function verifyAdmin(request: NextRequest): boolean {
  const token = request.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_PASSWORD
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
