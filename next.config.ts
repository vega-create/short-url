import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// 讓 next dev 也拿得到 Cloudflare 綁定（D1 / R2），與部署環境一致。
// 本機資料在 .wrangler/state/v3（wrangler d1 --local 也用同一份）。
initOpenNextCloudflareForDev();
