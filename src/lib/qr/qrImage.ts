// src/lib/qr/qrImage.ts
// QR Code 產生（純 JS，Workers 可跑）：
//   矩陣：uqr（ecc H、quiet zone 2 格，與原本 qrcode 套件的 margin: 2 相同）
//   PNG：raster.ts 自己畫點陣 → 疊背景圖 → 疊 Logo（白色圓角底）→ upng 編碼
//   SVG：模組畫成一條 path；背景圖／Logo 以 data URI 內嵌（瀏覽器 <img> 也能顯示）
// 背景圖／Logo 的 bytes 由呼叫端提供（R2 或 fetch），這裡不做網路。
import { encode as encodeQr } from 'uqr'
import {
  createRaster, decodeImage, drawImage, encodePng, fillRoundedRect, parseColor, resizeTo, sniffMime,
  type Raster, type RGBA,
} from './raster'

export type QrImageOptions = {
  url: string
  /** 輸出邊長（px） */
  size: number
  fgColor?: string | null
  bgColor?: string | null
  /** Logo 圖檔 bytes（PNG/JPEG 才會合成進 PNG；SVG 輸出任何格式都可內嵌） */
  logo?: Uint8Array | null
  /** 背景圖 bytes */
  bgImage?: Uint8Array | null
}

const QUIET_ZONE = 2
const LOGO_RATIO = 0.2 // Logo 佔整張圖 20%（ecc H 容錯 30%，仍可掃）
const LOGO_PAD_RATIO = 0.15
const LOGO_BG_RADIUS = 8

function matrix(url: string) {
  const qr = encodeQr(url, { ecc: 'H', border: QUIET_ZONE })
  return { n: qr.size, data: qr.data }
}

function logoGeometry(size: number) {
  const logoSize = Math.floor(size * LOGO_RATIO)
  const padding = Math.floor(logoSize * LOGO_PAD_RATIO)
  const bgSize = logoSize + padding * 2
  return { logoSize, padding, bgSize, bgX: Math.floor((size - bgSize) / 2), bgY: Math.floor((size - bgSize) / 2), logoX: Math.floor((size - logoSize) / 2), logoY: Math.floor((size - logoSize) / 2) }
}

/** 產生 PNG bytes */
export function renderQrPng(o: QrImageOptions): Uint8Array {
  const size = o.size
  const fg = parseColor(o.fgColor, [0, 0, 0, 255])
  const bgRaster = o.bgImage ? decodeImage(o.bgImage) : null
  // 有背景圖時亮模組透明，讓背景透出來（與原本 light: '#00000000' 相同）
  const light: RGBA = bgRaster ? [0, 0, 0, 0] : parseColor(o.bgColor, [255, 255, 255, 255])

  const canvas: Raster = bgRaster ? resizeTo(bgRaster, size, size, 'cover') : createRaster(size, size)
  drawModules(canvas, matrix(o.url), fg, light)

  if (o.logo) {
    const logoRaster = decodeImage(o.logo)
    if (logoRaster) {
      const g = logoGeometry(size)
      fillRoundedRect(canvas, g.bgX, g.bgY, g.bgSize, g.bgSize, LOGO_BG_RADIUS, [255, 255, 255, 255])
      const logo = resizeTo(logoRaster, g.logoSize, g.logoSize, 'contain', [255, 255, 255, 255])
      drawImage(canvas, logo, g.logoX, g.logoY)
    }
  }
  return encodePng(canvas)
}

function drawModules(canvas: Raster, m: { n: number; data: boolean[][] }, dark: RGBA, light: RGBA) {
  const { width: size } = canvas
  const scale = m.n / size
  for (let y = 0; y < size; y++) {
    const my = Math.min(m.n - 1, Math.floor(y * scale))
    const row = m.data[my]
    for (let x = 0; x < size; x++) {
      const mx = Math.min(m.n - 1, Math.floor(x * scale))
      const c = row[mx] ? dark : light
      if (!c[3]) continue
      const i = (y * size + x) * 4
      // 直接覆蓋（背景圖上的亮模組透明 → 不畫）
      canvas.data[i] = c[0]
      canvas.data[i + 1] = c[1]
      canvas.data[i + 2] = c[2]
      canvas.data[i + 3] = c[3]
    }
  }
}

function toDataUri(bytes: Uint8Array): string | null {
  const mime = sniffMime(bytes)
  if (!mime) return null
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return `data:${mime};base64,${btoa(bin)}`
}

function cssColor(c: RGBA): string {
  return c[3] === 255 ? `#${[c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` : `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(3)})`
}

/** 產生 SVG 字串 */
export function renderQrSvg(o: QrImageOptions): string {
  const size = o.size
  const m = matrix(o.url)
  const fg = parseColor(o.fgColor, [0, 0, 0, 255])
  const bg = parseColor(o.bgColor, [255, 255, 255, 255])
  const bgUri = o.bgImage ? toDataUri(o.bgImage) : null
  const logoUri = o.logo ? toDataUri(o.logo) : null

  let path = ''
  for (let y = 0; y < m.n; y++) {
    const row = m.data[y]
    for (let x = 0; x < m.n; x++) if (row[x]) path += `M${x} ${y}h1v1h-1z`
  }

  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`)
  if (bgUri) parts.push(`<image href="${bgUri}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"/>`)
  else parts.push(`<rect width="${size}" height="${size}" fill="${cssColor(bg)}"/>`)
  const s = size / m.n
  parts.push(`<path transform="scale(${s.toFixed(6)})" fill="${cssColor(fg)}" d="${path}"/>`)
  if (logoUri) {
    const g = logoGeometry(size)
    parts.push(`<rect x="${g.bgX}" y="${g.bgY}" width="${g.bgSize}" height="${g.bgSize}" rx="${LOGO_BG_RADIUS}" fill="#ffffff"/>`)
    parts.push(`<image href="${logoUri}" x="${g.logoX}" y="${g.logoY}" width="${g.logoSize}" height="${g.logoSize}" preserveAspectRatio="xMidYMid meet"/>`)
  }
  parts.push('</svg>')
  return parts.join('')
}
