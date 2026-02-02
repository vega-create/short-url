import { LinkTarget } from './types'

/**
 * 根據權重隨機選擇目標網址（A/B 分流）
 */
export function selectTargetByWeight(targets: LinkTarget[]): LinkTarget | null {
  const activeTargets = targets.filter(t => t.is_active)
  if (activeTargets.length === 0) return null
  if (activeTargets.length === 1) return activeTargets[0]

  const totalWeight = activeTargets.reduce((sum, t) => sum + t.weight, 0)
  let random = Math.random() * totalWeight

  for (const target of activeTargets) {
    random -= target.weight
    if (random <= 0) return target
  }
  return activeTargets[0]
}

/**
 * 偵測裝置類型
 */
export function detectDevice(userAgent: string): string {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

/**
 * 產生完整短網址
 */
export function buildShortUrl(domain: string, slug: string): string {
  const protocol = domain.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${domain}/${slug}`
}
