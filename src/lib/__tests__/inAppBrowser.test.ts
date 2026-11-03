import { describe, it, expect } from 'vitest'
import { detectInApp, detectOS, isBot, platformEnabled } from '../inAppBrowser'

const UA = {
  fbIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.39.108;FBBV/613868306;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/zh_TW;FBOP/5]',
  fbAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240405.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/465.0.0.47.105;]',
  messengerIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0.0.33.108;FBBV/598456812;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/zh_TW;FBOP/5]',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/459.0.0.46.108;]',
  igIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.0.42.95 (iPhone15,2; iOS 17_5; zh_TW; zh-TW; scale=3.00; 1179x2556; 598587621)',
  threadsAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP1A.240405.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Barcelona 334.0.0.38.95 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; zh_TW; 598587621)',
  lineIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.8.0/IAB',
  tiktok: 'Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 trill_2022803010 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/28.3.1 ByteLocale/zh-Hant-TW ByteFullLocale/zh-Hant-TW Region/TW BytedanceWebview/d8a21c6',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  fbBot: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  metaBot: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  lineBot: 'facebookexternalhit/1.1;line-poker/1.0',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

describe('detectInApp', () => {
  it('Facebook iOS / Android', () => {
    expect(detectInApp(UA.fbIos)).toBe('facebook')
    expect(detectInApp(UA.fbAndroid)).toBe('facebook')
  })
  it('Messenger 要分開（UA 也含 FBAN，但先判斷 Messenger）', () => {
    expect(detectInApp(UA.messengerIos)).toBe('messenger')
    expect(detectInApp(UA.messengerAndroid)).toBe('messenger')
  })
  it('Instagram / Threads / LINE / TikTok', () => {
    expect(detectInApp(UA.igIos)).toBe('instagram')
    expect(detectInApp(UA.threadsAndroid)).toBe('threads')
    expect(detectInApp(UA.lineIos)).toBe('line')
    expect(detectInApp(UA.tiktok)).toBe('tiktok')
  })
  it('一般瀏覽器回 null', () => {
    expect(detectInApp(UA.safari)).toBeNull()
    expect(detectInApp(UA.chromeAndroid)).toBeNull()
    expect(detectInApp(UA.desktop)).toBeNull()
    expect(detectInApp('')).toBeNull()
  })
  it('Airline/ 這種字不會誤判成 LINE', () => {
    expect(detectInApp('Mozilla/5.0 Airline/1.0')).toBeNull()
  })
})

describe('detectOS', () => {
  it('ios / android / other', () => {
    expect(detectOS(UA.fbIos)).toBe('ios')
    expect(detectOS(UA.igIos)).toBe('ios')
    expect(detectOS(UA.fbAndroid)).toBe('android')
    expect(detectOS(UA.threadsAndroid)).toBe('android')
    expect(detectOS(UA.desktop)).toBe('other')
  })
})

describe('isBot', () => {
  it('常見分享預覽爬蟲', () => {
    expect(isBot(UA.fbBot)).toBe(true)
    expect(isBot(UA.metaBot)).toBe(true)
    expect(isBot(UA.lineBot)).toBe(true)
    expect(isBot(UA.googlebot)).toBe(true)
  })
  it('真人不是爬蟲', () => {
    expect(isBot(UA.fbIos)).toBe(false)
    expect(isBot(UA.safari)).toBe(false)
    expect(isBot(UA.lineIos)).toBe(false)
  })
})

describe('platformEnabled', () => {
  it('勾了才觸發', () => {
    expect(platformEnabled('facebook', ['facebook', 'line'])).toBe(true)
    expect(platformEnabled('instagram', ['facebook', 'line'])).toBe(false)
  })
  it('Messenger 跟著 Facebook 的勾選', () => {
    expect(platformEnabled('messenger', ['facebook'])).toBe(true)
    expect(platformEnabled('messenger', ['instagram'])).toBe(false)
  })
  it('空值一律不觸發', () => {
    expect(platformEnabled(null, ['facebook'])).toBe(false)
    expect(platformEnabled('facebook', [])).toBe(false)
    expect(platformEnabled('facebook', null)).toBe(false)
  })
})
