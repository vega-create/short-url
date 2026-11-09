// src/lib/env.ts
// 讀設定值：先看 process.env（Workers 執行期 OpenNext 會把 secret 複製進來；Vercel／next dev 的 .env.local 也在這），
// 再看 Cloudflare 綁定 env（本機 next dev 讀 .dev.vars 時只放在這裡）。
import { getCloudflareContext } from '@opennextjs/cloudflare'

export function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (v) return v
  try {
    const cf = (getCloudflareContext().env as unknown as Record<string, unknown>)[name]
    return typeof cf === 'string' && cf ? cf : undefined
  } catch {
    return undefined
  }
}

/** 後台密碼；沒設定時回 undefined（呼叫端一律當成「拒絕」，不能因為兩邊都是 undefined 而放行） */
export function getAdminPassword(): string | undefined {
  return getEnv('ADMIN_PASSWORD')
}
