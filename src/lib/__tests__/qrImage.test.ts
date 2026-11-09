import { describe, it, expect } from 'vitest'
import jsQR from 'jsqr'
import UPNG from 'upng-js'
import { encode as encodeJpeg } from 'jpeg-js'
import { renderQrPng, renderQrSvg } from '../qr/qrImage'
import { createRaster, decodeImage, encodePng, fillRoundedRect, parseColor } from '../qr/raster'

const URL_ = 'https://aimom.vip/母親節'

// PNG bytes → RGBA，再用 jsQR 實際掃描
function scan(png: Uint8Array): string | null {
  const img = UPNG.decode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer)
  const rgba = new Uint8ClampedArray(UPNG.toRGBA8(img)[0])
  const r = jsQR(rgba, img.width, img.height)
  return r?.data ?? null
}

function fakeLogoPng(): Uint8Array {
  const r = createRaster(120, 80, [220, 30, 60, 255])
  fillRoundedRect(r, 20, 10, 80, 60, 20, [255, 255, 255, 255])
  return encodePng(r)
}

function fakeBgJpeg(): Uint8Array {
  const w = 300, h = 200
  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 200 + ((i % w) / w) * 55
    data[i * 4 + 1] = 230
    data[i * 4 + 2] = 240
    data[i * 4 + 3] = 255
  }
  return new Uint8Array(encodeJpeg({ data, width: w, height: h }, 90).data)
}

describe('QR 產生（純 JS）', () => {
  it('純色 PNG 可掃、尺寸正確、PNG 檔頭正確', () => {
    const png = renderQrPng({ url: URL_, size: 400, fgColor: '#000000', bgColor: '#ffffff' })
    expect(Array.from(png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    const img = decodeImage(png)!
    expect(img.width).toBe(400)
    expect(img.height).toBe(400)
    expect(scan(png)).toBe(URL_)
  })

  it('自訂顏色、非 400 的尺寸也可掃', () => {
    expect(scan(renderQrPng({ url: URL_, size: 257, fgColor: '#1e3a8a', bgColor: '#fef3c7' }))).toBe(URL_)
    expect(scan(renderQrPng({ url: 'https://go.test/x', size: 1000, fgColor: '#000', bgColor: '#fff' }))).toBe('https://go.test/x')
  })

  it('加 Logo（PNG）仍可掃，且中央確實畫了白底', () => {
    const png = renderQrPng({ url: URL_, size: 400, fgColor: '#000000', bgColor: '#ffffff', logo: fakeLogoPng() })
    expect(scan(png)).toBe(URL_)
    const img = decodeImage(png)!
    // Logo 白底邊緣（中心往外 bgSize/2 - 2px）應該是白色
    const bgSize = Math.floor(400 * 0.2) + Math.floor(Math.floor(400 * 0.2) * 0.15) * 2
    const x = 200 - Math.floor(bgSize / 2) + 2
    const i = (200 * 400 + x) * 4
    expect([img.data[i], img.data[i + 1], img.data[i + 2]]).toEqual([255, 255, 255])
  })

  it('加背景圖（JPEG）仍可掃', () => {
    const png = renderQrPng({ url: URL_, size: 400, fgColor: '#000000', bgColor: '#ffffff', bgImage: fakeBgJpeg() })
    expect(scan(png)).toBe(URL_)
    // 角落（quiet zone）應該透出背景色，不是純白
    const img = decodeImage(png)!
    expect(img.data[3]).toBe(255)
    expect(img.data[0]).toBeLessThan(255)
  })

  it('背景圖 + Logo 同時存在仍可掃', () => {
    const png = renderQrPng({ url: URL_, size: 500, fgColor: '#000000', bgColor: '#ffffff', bgImage: fakeBgJpeg(), logo: fakeLogoPng() })
    expect(scan(png)).toBe(URL_)
  })

  it('不支援的圖片格式會降級（不丟錯、QR 照樣可掃）', () => {
    const garbage = new TextEncoder().encode('not an image at all')
    const png = renderQrPng({ url: URL_, size: 300, fgColor: '#000', bgColor: '#fff', logo: garbage, bgImage: garbage })
    expect(scan(png)).toBe(URL_)
  })

  it('SVG：有尺寸、顏色、path；Logo／背景以 data URI 內嵌', () => {
    const svg = renderQrSvg({ url: URL_, size: 400, fgColor: '#112233', bgColor: '#ffffff', logo: fakeLogoPng(), bgImage: fakeBgJpeg() })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"')).toBe(true)
    expect(svg).toContain('fill="#112233"')
    expect(svg).toContain('<path transform="scale(')
    expect(svg).toContain('data:image/png;base64,')
    expect(svg).toContain('data:image/jpeg;base64,')
    expect(svg).toContain('rx="8" fill="#ffffff"')
    const plain = renderQrSvg({ url: URL_, size: 400, fgColor: '#000', bgColor: '#fff' })
    expect(plain).toContain('<rect width="400" height="400" fill="#ffffff"/>')
    expect(plain).not.toContain('<image')
  })

  it('parseColor', () => {
    expect(parseColor('#fff', [0, 0, 0, 255])).toEqual([255, 255, 255, 255])
    expect(parseColor('#00000000', [0, 0, 0, 255])).toEqual([0, 0, 0, 0])
    expect(parseColor('red', [1, 2, 3, 255])).toEqual([1, 2, 3, 255])
  })
})
