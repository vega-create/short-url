import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// 預設設定即可跑；短網址站沒有 ISR，不需要 incrementalCache。
export default defineCloudflareConfig({})
