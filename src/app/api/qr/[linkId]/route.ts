import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getR2, r2KeyFromUrl } from '@/lib/db'
import { renderQrPng, renderQrSvg } from '@/lib/qr/qrImage'

// 2026-11：搬到 Cloudflare Workers 後跑不了 sharp，QR 改用純 JS 產生（src/lib/qr/）。
// 行為與原本相同：ecc H、quiet zone 2、Logo 佔 20% 置中加白色圓角底、背景圖 cover 鋪滿。

const MIN_SIZE = 64
const MAX_SIZE = 2000

/** 讀圖片 bytes：自家上傳（/api/files/<key>）直接從 R2 拿，其他網址用 fetch；失敗回 null（降級為不加圖） */
async function loadImage(url: string | null | undefined): Promise<Uint8Array | null> {
  if (!url) return null
  try {
    const key = r2KeyFromUrl(url)
    if (key) {
      const obj = await getR2().get(key)
      return obj ? new Uint8Array(await obj.arrayBuffer()) : null
    }
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

// GET: 產生 QR Code 圖片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params
  const { searchParams } = new URL(request.url)
  const requested = parseInt(searchParams.get('size') || '400')
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number.isFinite(requested) ? requested : 400))
  const format = searchParams.get('format') || 'png'

  const { data: link } = await supabaseAdmin
    .from('short_links')
    .select('*, domains(domain), qr_settings(*)')
    .eq('id', linkId)
    .single()

  if (!link) {
    return NextResponse.json({ error: '找不到短網址' }, { status: 404 })
  }

  const domain = (link.domains as { domain: string }).domain
  const protocol = domain.includes('localhost') ? 'http' : 'https'
  const url = `${protocol}://${domain}/${link.slug}`

  // QR 設定（可能為陣列或單一物件）
  const settings = Array.isArray(link.qr_settings)
    ? link.qr_settings[0] || {}
    : link.qr_settings || {}

  const [bgImage, logo] = await Promise.all([loadImage(settings.bg_image_url), loadImage(settings.logo_url)])

  const opts = {
    url,
    size,
    fgColor: settings.fg_color || '#000000',
    bgColor: settings.bg_color || '#ffffff',
    bgImage,
    logo,
  }

  if (format === 'svg') {
    return new NextResponse(renderQrSvg(opts), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  const png = renderQrPng(opts)
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

// PUT: 更新 QR Code 設定
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params
  const body = await request.json()

  // Upsert: 有就更新，沒有就新增
  const { data, error } = await supabaseAdmin
    .from('qr_settings')
    .upsert(
      { short_link_id: linkId, ...body },
      { onConflict: 'short_link_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
