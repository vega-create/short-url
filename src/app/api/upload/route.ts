import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) {
    return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'png'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // 上傳到 Supabase Storage
  const { data, error } = await supabaseAdmin.storage
    .from('uploads')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 取得公開網址
  const { data: urlData } = supabaseAdmin.storage
    .from('uploads')
    .getPublicUrl(data.path)

  return NextResponse.json({ url: urlData.publicUrl })
}
