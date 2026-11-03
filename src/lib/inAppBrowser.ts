/**
 * App 內建瀏覽器 / 作業系統 / 爬蟲 偵測（純 User-Agent 判斷）
 *
 * 關鍵字來源是各 App 目前的 UA，App 改版可能變動，
 * 有異常時先用後台「點擊分析」的 user_agent 欄位對照再調整這裡。
 */

export type InAppPlatform = 'facebook' | 'messenger' | 'instagram' | 'threads' | 'line' | 'tiktok'
export type ClientOS = 'ios' | 'android' | 'other'

/** 後台可勾選的平台（Messenger 的 UA 也含 FBAN，勾 Facebook 就一起生效） */
export const EXTERNAL_PLATFORM_OPTIONS: { value: InAppPlatform; label: string; note?: string }[] = [
  { value: 'facebook', label: 'Facebook（含 Messenger）' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'threads', label: 'Threads' },
  { value: 'line', label: 'LINE', note: '官方支援，最穩' },
  { value: 'tiktok', label: 'TikTok', note: '無法自動跳出，只會顯示手動引導' },
]

export const DEFAULT_EXTERNAL_PLATFORMS: InAppPlatform[] = ['facebook', 'instagram', 'threads', 'line']

const BOT_RE = /facebookexternalhit|Facebot|meta-externalagent|LinkedInBot|Twitterbot|Googlebot|bingbot|Applebot|WhatsApp|TelegramBot|Slackbot|Discordbot|Pinterestbot|SkypeUriPreview/i

export function isBot(ua: string): boolean {
  return BOT_RE.test(ua)
}

/** 順序有意義：Threads / Messenger 的 UA 也可能含 Instagram / FBAN 關鍵字，要先判斷 */
export function detectInApp(ua: string): InAppPlatform | null {
  if (/Barcelona/i.test(ua)) return 'threads'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/MessengerForiOS|MessengerLiteForiOS|Orca-Android|\bMessenger\b/i.test(ua)) return 'messenger'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/\bLine\//.test(ua)) return 'line'
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) return 'tiktok'
  return null
}

export function detectOS(ua: string): ClientOS {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/** 這個 App 有沒有被勾選要觸發外開（Messenger 歸在 Facebook） */
export function platformEnabled(inApp: InAppPlatform | null, enabled: string[] | null | undefined): boolean {
  if (!inApp || !enabled || enabled.length === 0) return false
  const key = inApp === 'messenger' ? 'facebook' : inApp
  return enabled.includes(key)
}
