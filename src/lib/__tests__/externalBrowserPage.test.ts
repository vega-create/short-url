import { describe, it, expect } from 'vitest'
import { renderExternalBrowserPage } from '../externalBrowserPage'

const base = {
  escapeUrl: 'https://aimom.vip/sale/FB?fbclid=abc&_ext=1&_from=facebook',
  stayUrl: 'https://aimom.vip/sale/FB?fbclid=abc&_ext=0&_from=facebook',
  copyUrl: 'https://aimom.vip/sale/FB',
  title: '雙 11 特賣',
}

async function render(opts: Parameters<typeof renderExternalBrowserPage>[0]) {
  const res = renderExternalBrowserPage(opts)
  return { res, html: await res.text() }
}

describe('renderExternalBrowserPage', () => {
  it('是 HTML、不快取、不被搜尋引擎收錄', async () => {
    const { res, html } = await render({ ...base, platform: 'facebook', os: 'ios' })
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(html).toContain('name="robots" content="noindex')
  })

  it('三個網址都有放進去，而且永遠有「繼續在這裡瀏覽」出口（含 noscript）', async () => {
    const { html } = await render({ ...base, platform: 'instagram', os: 'android' })
    expect(html).toContain(JSON.stringify(base.escapeUrl))
    expect(html).toContain(JSON.stringify(base.copyUrl))
    expect(html).toContain('繼續在這裡瀏覽')
    expect(html).toContain('<noscript>')
    // href 裡的 & 要轉成 &amp;
    expect(html).toContain('href="https://aimom.vip/sale/FB?fbclid=abc&amp;_ext=0&amp;_from=facebook"')
  })

  it('標題裡的 HTML / </script> 不會把頁面弄壞', async () => {
    const { html } = await render({ ...base, platform: 'line', os: 'ios', title: '<b>x</b></script><script>alert(1)</script>' })
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    // 內嵌 JS 裡的字串若含 < 一律轉成 \u003c
    const { html: html2 } = await render({ ...base, platform: 'line', os: 'ios', escapeUrl: 'https://a.b/?q=</script>' })
    expect(html2).not.toContain('"https://a.b/?q=</script>"')
    expect(html2).toContain('\\u003c/script>')
  })

  it('TikTok 沒有自動跳轉按鈕，直接顯示引導', async () => {
    const { html } = await render({ ...base, platform: 'tiktok', os: 'android' })
    expect(html).not.toContain('id="b"')
    expect(html).toContain('AUTO=false')
  })

  it('LINE 的提示在右下角，其他在右上角', async () => {
    const { html: line } = await render({ ...base, platform: 'line', os: 'ios' })
    const { html: fb } = await render({ ...base, platform: 'facebook', os: 'ios' })
    expect(line).toContain('右下角')
    expect(fb).toContain('右上角')
  })

  it('頁面極輕量（< 10KB，不載入外部資源）', async () => {
    const { html } = await render({ ...base, platform: 'facebook', os: 'ios' })
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(10 * 1024)
    expect(html).not.toMatch(/<link[^>]+href="http/)
    expect(html).not.toMatch(/<script[^>]+src=/)
  })
})
