import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import QRCode from 'qrcode'
import sharp from 'sharp'

// GET: 產生 QR Code 圖片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params
  const { searchParams } = new URL(request.url)
  const size = parseInt(searchParams.get('size') || '400')
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

  // 產生 QR Code
  const qrBuffer = await QRCode.toBuffer(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H', // 高容錯，才能放 Logo
    color: {
      dark: settings.fg_color || '#000000',
      light: settings.bg_color || '#ffffff',
    },
  })

  // 如果有 Logo，合成到中央
  if (settings.logo_url) {
    try {
      const logoResponse = await fetch(settings.logo_url)
      const logoArrayBuffer = await logoResponse.arrayBuffer()
      const logoSize = Math.floor(size * 0.2) // Logo 佔 20%

      const logo = await sharp(Buffer.from(logoArrayBuffer))
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer()

      // 建立白色背景圓角方塊（Logo 底）
      const padding = Math.floor(logoSize * 0.15)
      const bgSize = logoSize + padding * 2
      const bgSvg = `<svg width="${bgSize}" height="${bgSize}">
        <rect width="${bgSize}" height="${bgSize}" rx="8" fill="white"/>
      </svg>`

      const bgBuffer = await sharp(Buffer.from(bgSvg)).png().toBuffer()

      const final = await sharp(qrBuffer)
        .composite([
          { input: bgBuffer, gravity: 'center' },
          { input: logo, gravity: 'center' },
        ])
        .png()
        .toBuffer()

      return new NextResponse(new Uint8Array(final), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch {
      // Logo 載入失敗，回傳無 Logo 版本
    }
  }

  // SVG 格式
  if (format === 'svg') {
    const svgString = await QRCode.toString(url, {
      type: 'svg',
      width: size,
      margin: 2,
      color: {
        dark: settings.fg_color || '#000000',
        light: settings.bg_color || '#ffffff',
      },
    })

    return new NextResponse(svgString, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return new NextResponse(new Uint8Array(qrBuffer), {
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
