import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (password === process.env.ADMIN_PASSWORD) {
    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_token', process.env.ADMIN_PASSWORD!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
}
