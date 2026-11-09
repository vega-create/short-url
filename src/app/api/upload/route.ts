import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth'

// 2026-11：檔案改存 Cloudflare R2（原 Supabase Storage bucket `uploads`），
// 由 /api/files/<key> 讀出；回傳的網址是絕對網址，Bio 頁的 og:image 才能用。
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) {
    return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  // 上傳到 R2
  const { data, error } = await supabaseAdmin.storage
    .from('uploads')
    .upload(fileName, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })

  if (error || !data) {
    return NextResponse.json({ error: error?.message || '上傳失敗' }, { status: 500 })
  }

  // 取得公開網址（相對路徑 → 接上目前的網域）
  const { data: urlData } = supabaseAdmin.storage
    .from('uploads')
    .getPublicUrl(data.path)

  const host = request.headers.get('host') || ''
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')

  return NextResponse.json({ url: `${proto}://${host}${urlData.publicUrl}` })
}
