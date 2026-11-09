// src/lib/qr/raster.ts
// 純 JS 的 RGBA 點陣圖工具（Cloudflare Workers 跑不了 sharp）：
//   decodeImage：PNG（upng-js）／JPEG（jpeg-js）→ RGBA；其他格式回 null，呼叫端自行降級
//   resizeTo：box filter 縮放（cover / contain）
//   drawImage：alpha over 合成
//   fillRoundedRect：Logo 底的白色圓角方塊
//   encodePng：RGBA → PNG（upng-js 無損）
import UPNG from 'upng-js'
import { decode as decodeJpeg } from 'jpeg-js'

export type Raster = { width: number; height: number; data: Uint8Array } // RGBA, 4 bytes / px
export type RGBA = [number, number, number, number]

export function createRaster(width: number, height: number, fill?: RGBA): Raster {
  const data = new Uint8Array(width * height * 4)
  if (fill && (fill[0] || fill[1] || fill[2] || fill[3])) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0]
      data[i + 1] = fill[1]
      data[i + 2] = fill[2]
      data[i + 3] = fill[3]
    }
  }
  return { width, height, data }
}

/** 由檔頭判斷圖片格式 */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  const head = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 512))).trimStart()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml'
  return null
}

/** PNG / JPEG → RGBA；不支援的格式回 null */
export function decodeImage(bytes: Uint8Array): Raster | null {
  const mime = sniffMime(bytes)
  try {
    if (mime === 'image/png') {
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const img = UPNG.decode(buf)
      const frames = UPNG.toRGBA8(img)
      if (!frames.length) return null
      return { width: img.width, height: img.height, data: new Uint8Array(frames[0]) }
    }
    if (mime === 'image/jpeg') {
      const img = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 })
      return { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength) }
    }
  } catch {
    return null
  }
  return null
}

/** 把 src 縮放到 dw×dh 後畫到 dst 的 (dx, dy)（box filter，alpha 加權，alpha over 合成） */
export function drawScaled(dst: Raster, src: Raster, dx: number, dy: number, dw: number, dh: number) {
  if (dw <= 0 || dh <= 0) return
  const sxRatio = src.width / dw
  const syRatio = src.height / dh
  for (let y = 0; y < dh; y++) {
    const ty = dy + y
    if (ty < 0 || ty >= dst.height) continue
    const sy0 = Math.floor(y * syRatio)
    const sy1 = Math.max(sy0 + 1, Math.ceil((y + 1) * syRatio))
    for (let x = 0; x < dw; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= dst.width) continue
      const sx0 = Math.floor(x * sxRatio)
      const sx1 = Math.max(sx0 + 1, Math.ceil((x + 1) * sxRatio))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let sy = sy0; sy < sy1 && sy < src.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < src.width; sx++) {
          const i = (sy * src.width + sx) * 4
          const pa = src.data[i + 3]
          r += src.data[i] * pa
          g += src.data[i + 1] * pa
          b += src.data[i + 2] * pa
          a += pa
          n++
        }
      }
      if (!n || !a) continue
      blendPixel(dst, tx, ty, r / a, g / a, b / a, a / n)
    }
  }
}

function blendPixel(dst: Raster, x: number, y: number, r: number, g: number, b: number, a: number) {
  const i = (y * dst.width + x) * 4
  const sa = a / 255
  const da = dst.data[i + 3] / 255
  const oa = sa + da * (1 - sa)
  if (oa <= 0) return
  dst.data[i] = Math.round((r * sa + dst.data[i] * da * (1 - sa)) / oa)
  dst.data[i + 1] = Math.round((g * sa + dst.data[i + 1] * da * (1 - sa)) / oa)
  dst.data[i + 2] = Math.round((b * sa + dst.data[i + 2] * da * (1 - sa)) / oa)
  dst.data[i + 3] = Math.round(oa * 255)
}

/** 新圖 w×h：cover＝填滿裁切、contain＝等比縮入置中（空白處填 bg） */
export function resizeTo(src: Raster, w: number, h: number, fit: 'cover' | 'contain', bg: RGBA = [0, 0, 0, 0]): Raster {
  const out = createRaster(w, h, bg)
  const scale = fit === 'cover' ? Math.max(w / src.width, h / src.height) : Math.min(w / src.width, h / src.height)
  const dw = Math.max(1, Math.round(src.width * scale))
  const dh = Math.max(1, Math.round(src.height * scale))
  drawScaled(out, src, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh)
  return out
}

/** 不縮放，直接以 alpha over 畫到 (dx, dy) */
export function drawImage(dst: Raster, src: Raster, dx: number, dy: number) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y
    if (ty < 0 || ty >= dst.height) continue
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= dst.width) continue
      const i = (y * src.width + x) * 4
      if (!src.data[i + 3]) continue
      blendPixel(dst, tx, ty, src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3])
    }
  }
}

export function fillRect(dst: Raster, x0: number, y0: number, w: number, h: number, c: RGBA) {
  for (let y = Math.max(0, y0); y < Math.min(dst.height, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(dst.width, x0 + w); x++) blendPixel(dst, x, y, c[0], c[1], c[2], c[3])
}

export function fillRoundedRect(dst: Raster, x0: number, y0: number, w: number, h: number, radius: number, c: RGBA) {
  const r = Math.min(radius, w / 2, h / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 角落：距圓心超過 r 就略過（邊緣做簡單抗鋸齒）
      const cx = x < r ? r - 0.5 - x : x > w - 1 - r ? x - (w - 1 - r) - 0.5 : 0
      const cy = y < r ? r - 0.5 - y : y > h - 1 - r ? y - (h - 1 - r) - 0.5 : 0
      let cov = 1
      if (cx > 0 && cy > 0) {
        const d = Math.sqrt(cx * cx + cy * cy)
        cov = Math.min(1, Math.max(0, r - d + 0.5))
        if (cov <= 0) continue
      }
      const tx = x0 + x
      const ty = y0 + y
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue
      blendPixel(dst, tx, ty, c[0], c[1], c[2], c[3] * cov)
    }
  }
}

/** '#rgb' / '#rrggbb' / '#rrggbbaa' → RGBA；壞值回 fallback */
export function parseColor(input: string | null | undefined, fallback: RGBA): RGBA {
  if (!input) return fallback
  const s = input.trim()
  const m = s.match(/^#([0-9a-f]{3,8})$/i)
  if (!m) return fallback
  let h = m[1]
  if (h.length === 3 || h.length === 4) h = h.split('').map((ch) => ch + ch).join('')
  if (h.length !== 6 && h.length !== 8) return fallback
  const n = parseInt(h, 16)
  if (h.length === 6) return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
  return [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function encodePng(r: Raster): Uint8Array {
  const buf = r.data.buffer.slice(r.data.byteOffset, r.data.byteOffset + r.data.byteLength) as ArrayBuffer
  return new Uint8Array(UPNG.encode([buf], r.width, r.height, 0))
}
