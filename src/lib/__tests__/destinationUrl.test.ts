import { describe, it, expect } from 'vitest'
import { buildDestinationUrl, buildReturnUrl } from '../destinationUrl'

const q = (s: string) => new URLSearchParams(s)

describe('buildDestinationUrl', () => {
  it('沒有任何參數要加時，原樣回傳（不做 URL 正規化）', () => {
    expect(buildDestinationUrl('https://shop.example.com', null)).toBe('https://shop.example.com')
    expect(buildDestinationUrl('https://shop.example.com/中文頁', q(''))).toBe('https://shop.example.com/中文頁')
  })

  it('fbclid / gclid / utm_* 會被轉傳到目的地', () => {
    const out = buildDestinationUrl('https://shop.example.com/p/1', q('fbclid=abc&utm_source=fb'))
    const u = new URL(out)
    expect(u.searchParams.get('fbclid')).toBe('abc')
    expect(u.searchParams.get('utm_source')).toBe('fb')
  })

  it('目的地自己帶的參數最優先，不被覆蓋', () => {
    const out = buildDestinationUrl(
      'https://shop.example.com/?utm_source=official',
      q('utm_source=fb'),
      { utm_source: 'backend' }
    )
    expect(new URL(out).searchParams.get('utm_source')).toBe('official')
  })

  it('後台設定優先於使用者帶進來的參數', () => {
    const out = buildDestinationUrl(
      'https://shop.example.com/',
      q('utm_source=fb&utm_campaign=incoming'),
      { utm_source: 'backend', utm_medium: 'cpc' }
    )
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('backend')
    expect(u.searchParams.get('utm_medium')).toBe('cpc')
    expect(u.searchParams.get('utm_campaign')).toBe('incoming')
  })

  it('後台設定的空值會被略過', () => {
    const out = buildDestinationUrl('https://shop.example.com/', null, { utm_source: 'fb', utm_term: null, utm_content: '' })
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('fb')
    expect(u.searchParams.has('utm_term')).toBe(false)
    expect(u.searchParams.has('utm_content')).toBe(false)
  })

  it('_ext / _from / openExternalBrowser 絕不轉傳到目的地', () => {
    const out = buildDestinationUrl('https://shop.example.com/', q('_ext=1&_from=line&openExternalBrowser=1&fbclid=x'))
    const u = new URL(out)
    expect(u.searchParams.has('_ext')).toBe(false)
    expect(u.searchParams.has('_from')).toBe(false)
    expect(u.searchParams.has('openExternalBrowser')).toBe(false)
    expect(u.searchParams.get('fbclid')).toBe('x')
  })

  it('只有內部參數時也原樣回傳', () => {
    expect(buildDestinationUrl('https://shop.example.com', q('_ext=1'))).toBe('https://shop.example.com')
  })

  it('目的地不是合法 URL 就原樣回傳，不炸', () => {
    expect(buildDestinationUrl('not a url', q('a=1'))).toBe('not a url')
  })
})

describe('buildReturnUrl', () => {
  it('保留路徑與原參數，加上 _ext，去掉舊的內部標記', () => {
    const out = buildReturnUrl('https://aimom.vip/sale/FB?fbclid=abc&_ext=0', q('fbclid=abc&_ext=0'), '1')
    const u = new URL(out)
    expect(u.pathname).toBe('/sale/FB')
    expect(u.searchParams.get('fbclid')).toBe('abc')
    expect(u.searchParams.get('_ext')).toBe('1')
  })

  it('LINE 可以再加 openExternalBrowser=1', () => {
    const out = buildReturnUrl('https://aimom.vip/sale', q(''), '1', { openExternalBrowser: '1' })
    const u = new URL(out)
    expect(u.searchParams.get('_ext')).toBe('1')
    expect(u.searchParams.get('openExternalBrowser')).toBe('1')
  })
})
