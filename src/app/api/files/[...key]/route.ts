import { NextRequest, NextResponse } from 'next/server'
import { getR2 } from '@/lib/db'

// GET /api/files/<bucket>/<檔名>：從 R2 讀出上傳的圖片（QR Logo／背景圖、Bio Logo）。
// 檔名含時間戳與亂數、不會重複，所以可以長快取。公開讀取（Bio 頁與 QR 預覽都要用）。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params
  const objectKey = key.map((s) => decodeURIComponent(s)).join('/')
  if (!objectKey || objectKey.includes('..')) {
    return NextResponse.json({ error: '找不到檔案' }, { status: 404 })
  }

  const obj = await getR2().get(objectKey)
  if (!obj) {
    return NextResponse.json({ error: '找不到檔案' }, { status: 404 })
  }

  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('ETag', obj.httpEtag)
  return new NextResponse(obj.body as unknown as ReadableStream, { headers })
}
