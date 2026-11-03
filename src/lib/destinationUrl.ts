/**
 * 目的地網址組合。
 *
 * 優先順序（高 → 低）：
 *   1. 目的地網址自己帶的參數
 *   2. 後台設定的參數（例如 append_utm 的 UTM）
 *   3. 使用者點短網址時帶進來的參數（fbclid / gclid / utm_* …）
 *
 * `_ext`、`_from`、`openExternalBrowser` 是系統內部用的標記，不轉傳到目的地。
 */

export const INTERNAL_PARAMS = ['_ext', '_from', 'openExternalBrowser'] as const

type ParamSource = URLSearchParams | Record<string, string> | null | undefined

function toSearchParams(src: ParamSource): URLSearchParams {
  if (src instanceof URLSearchParams) return src
  return new URLSearchParams(src || {})
}

function isInternal(key: string): boolean {
  return (INTERNAL_PARAMS as readonly string[]).includes(key)
}

export function buildDestinationUrl(
  destination: string,
  incoming: ParamSource,
  backendParams: Record<string, string | null | undefined> = {}
): string {
  const inc = toSearchParams(incoming)
  const hasIncoming = [...inc.keys()].some(k => !isInternal(k))
  const hasBackend = Object.values(backendParams).some(v => !!v)

  // 什麼都不用加就原樣回傳，避免 URL 正規化改到原本的網址
  if (!hasIncoming && !hasBackend) return destination

  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }

  for (const [key, val] of Object.entries(backendParams)) {
    if (val && !url.searchParams.has(key)) url.searchParams.set(key, val)
  }

  for (const [key, val] of inc.entries()) {
    if (isInternal(key)) continue
    if (!url.searchParams.has(key)) url.searchParams.set(key, val)
  }

  return url.toString()
}

/**
 * 中轉頁用：組出「回到短網址本身」的網址，保留原路徑與原參數，加上 _ext 標記。
 *   _ext=1 → 已在外部瀏覽器開啟（跳出成功）
 *   _ext=0 → 使用者選擇留在 App 內繼續瀏覽
 */
export function buildReturnUrl(
  selfUrl: string,
  incoming: ParamSource,
  ext: '0' | '1',
  extra: Record<string, string> = {}
): string {
  const url = new URL(selfUrl)
  url.search = ''
  for (const [key, val] of toSearchParams(incoming).entries()) {
    if (!isInternal(key)) url.searchParams.set(key, val)
  }
  url.searchParams.set('_ext', ext)
  for (const [key, val] of Object.entries(extra)) url.searchParams.set(key, val)
  return url.toString()
}
