'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
  domains: number
  links: number
  bioPages: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ domains: 0, links: 0, bioPages: 0 })
  const [loading, setLoading] = useState(true)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/domains').then(r => r.json()),
      fetch('/api/links').then(r => r.json()),
      fetch('/api/bio').then(r => r.json()),
    ]).then(([domains, links, bio]) => {
      setStats({
        domains: Array.isArray(domains) ? domains.length : 0,
        links: Array.isArray(links) ? links.length : 0,
        bioPages: Array.isArray(bio) ? bio.length : 0,
      })
      setLoading(false)
    })
  }, [])

  const cards = [
    { label: '網域數量', value: stats.domains, icon: '🌐', href: '/vega888admin/domains', color: 'bg-red-50 text-red-700' },
    { label: '短網址數量', value: stats.links, icon: '🔗', href: '/vega888admin/links', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Bio 頁面', value: stats.bioPages, icon: '📄', href: '/vega888admin/bio', color: 'bg-violet-50 text-violet-700' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-8">系統總覽</h1>

      {loading ? (
        <div className="text-gray-500">載入中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {cards.map(card => (
              <Link key={card.href} href={card.href} className="block">
                <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{card.icon}</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${card.color}`}>
                      管理
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-800 mb-1">{card.value}</div>
                  <div className="text-sm text-gray-500">{card.label}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">快速開始</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/vega888admin/domains" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                <span className="text-2xl">🌐</span>
                <div>
                  <div className="font-medium text-gray-800">新增網域</div>
                  <div className="text-sm text-gray-500">設定你的自訂網域或子網域</div>
                </div>
              </Link>
              <Link href="/vega888admin/links" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                <span className="text-2xl">🔗</span>
                <div>
                  <div className="font-medium text-gray-800">建立短網址</div>
                  <div className="text-sm text-gray-500">建立新的短網址並設定目標</div>
                </div>
              </Link>
              <Link href="/vega888admin/bio" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                <span className="text-2xl">📄</span>
                <div>
                  <div className="font-medium text-gray-800">建立 Bio 頁面</div>
                  <div className="text-sm text-gray-500">建立連結收集頁面</div>
                </div>
              </Link>
              <Link href="/vega888admin/links" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                <span className="text-2xl">📱</span>
                <div>
                  <div className="font-medium text-gray-800">QR Code</div>
                  <div className="text-sm text-gray-500">為短網址產生品牌 QR Code</div>
                </div>
              </Link>
            </div>
          </div>

          {/* 使用說明 */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-6 flex items-center justify-between text-left"
            >
              <h2 className="text-lg font-semibold text-gray-800">📖 使用說明</h2>
              <span className={`text-gray-400 transition-transform duration-200 inline-block ${showGuide ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showGuide && (
              <div className="px-6 pb-6 space-y-8">

                {/* Step 1 */}
                <section>
                  <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    新增網域
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <p>到「🌐 網域管理」新增你要使用的網域或子網域。</p>
                    <p className="font-medium text-gray-800 mt-2">支援格式：</p>
                    <div className="bg-white rounded p-3 font-mono text-xs space-y-1">
                      <div>go.smartmommy.com <span className="text-gray-400 ml-2">← 子網域</span></div>
                      <div>link.yoursite.com <span className="text-gray-400 ml-2">← 子網域</span></div>
                      <div>smartmommy.link <span className="text-gray-400 ml-2">← 主網域</span></div>
                    </div>
                    <p className="font-medium text-gray-800 mt-3">DNS 設定（到你的 DNS 服務商操作）：</p>
                    <div className="bg-white rounded p-3 font-mono text-xs">
                      <div>類型：CNAME</div>
                      <div>名稱：go（或你想要的子網域名稱）</div>
                      <div>值：cname.vercel-dns.com</div>
                    </div>
                    <p className="font-medium text-gray-800 mt-3">Vercel 設定：</p>
                    <p>到 Vercel 專案 → Settings → Domains → 把網域加進去。</p>
                    <p className="text-gray-500 mt-2">三個地方都設定好（DNS + Vercel + 這裡），網域就能生效了。</p>
                  </div>
                </section>

                {/* Step 2 */}
                <section>
                  <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    建立短網址
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <p>到「🔗 短網址管理」建立短網址。</p>
                    <p className="font-medium text-gray-800 mt-2">設定項目：</p>
                    <div className="space-y-1.5">
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>選擇網域</strong>：選一個你已新增的網域</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>短碼（Slug）</strong>：網址後面的路徑，例如「母親節」「活動」「sale2026」</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>目標網址</strong>：要導向的目的地網址</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>備註</strong>：方便自己辨識用途（選填）</span></div>
                    </div>
                    <div className="bg-white rounded p-3 mt-3 text-xs">
                      <div className="font-medium text-gray-800 mb-1">範例：</div>
                      <div className="font-mono">go.smartmommy.com/<strong>母親節</strong> → https://your-landing-page.com</div>
                    </div>
                    <p className="text-gray-500 mt-2">💡 目標網址隨時可以換，已發出去的短網址和 QR Code 都不用改！</p>
                  </div>
                </section>

                {/* Step 3 */}
                <section>
                  <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    路徑參數追蹤
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <p>短網址後面可以<strong>隨意加上斜線和文字</strong>，全部都會導向同一個目標。用來區分不同渠道的流量來源。</p>
                    <div className="bg-white rounded p-3 font-mono text-xs space-y-1 mt-2">
                      <div>go.smartmommy.com/母親節<span className="text-emerald-600 font-bold">/FB</span></div>
                      <div>go.smartmommy.com/母親節<span className="text-emerald-600 font-bold">/IG/限動</span></div>
                      <div>go.smartmommy.com/母親節<span className="text-emerald-600 font-bold">/LINE/群組</span></div>
                      <div>go.smartmommy.com/母親節<span className="text-emerald-600 font-bold">/KOL/某網紅</span></div>
                      <div className="text-gray-400 mt-2">↑ 全部導向同一個目標網址</div>
                    </div>
                    <p className="text-gray-500 mt-2">系統只看第一段「母親節」來配對，後面的參數不影響導向。在 GA4 中可以用 Page Path 來分辨各渠道的流量。</p>
                  </div>
                </section>

                {/* Step 4 */}
                <section>
                  <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                    A/B 分流測試
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <p>一個短網址可以設定多個目標網址，系統會根據權重自動分配流量。</p>
                    <p className="font-medium text-gray-800 mt-2">操作方式：</p>
                    <div className="space-y-1.5">
                      <div className="flex gap-2"><span className="text-red-500">1.</span><span>在短網址列表點「編輯」</span></div>
                      <div className="flex gap-2"><span className="text-red-500">2.</span><span>在「A/B 分流目標」區塊新增多個目標</span></div>
                      <div className="flex gap-2"><span className="text-red-500">3.</span><span>設定每個目標的權重數字</span></div>
                    </div>
                    <div className="bg-white rounded p-3 mt-2 text-xs">
                      <div className="font-medium text-gray-800 mb-1">範例：</div>
                      <div>目標 A：landing-v1.com → 權重 <strong>5</strong>（50%）</div>
                      <div>目標 B：landing-v2.com → 權重 <strong>3</strong>（30%）</div>
                      <div>目標 C：landing-v3.com → 權重 <strong>2</strong>（20%）</div>
                    </div>
                    <p className="text-gray-500 mt-2">💡 適合測試不同 Landing Page、不同文案圖片的轉換率。</p>
                  </div>
                </section>

                {/* Step 5 */}
                <section>
                  <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                    QR Code 產生器
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <p>每個短網址都可以產生專屬 QR Code。在短網址列表中，點「QR」按鈕。</p>
                    <p className="font-medium text-gray-800 mt-2">可自訂：</p>
                    <div className="space-y-1.5">
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>前景色</strong>：QR Code 點點的顏色（可配合品牌色）</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>背景色</strong>：底色</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>Logo</strong>：填入圖片網址，會顯示在 QR Code 正中央</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>下載格式</strong>：PNG（印刷用）或 SVG（向量圖）</span></div>
                    </div>
                  </div>
                </section>

                {/* Step 6 */}
                <section>
                  <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">6</span>
                    Link in Bio 頁面
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <p>建立連結收集頁面，放在 IG、LINE 等社群個人檔案上。</p>
                    <p className="font-medium text-gray-800 mt-2">客製化選項：</p>
                    <div className="space-y-1.5">
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>Logo、標題、簡介</strong></span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>背景</strong>：純色 / 漸層（9 種預設）/ 自訂背景圖片</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>按鈕樣式</strong>：圓角 / 膠囊 / 方形 / 外框 / 毛玻璃</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>配色</strong>：文字色、按鈕色、按鈕文字色</span></div>
                      <div className="flex gap-2"><span className="text-red-500">•</span><span><strong>連結數量無上限</strong></span></div>
                    </div>
                    <div className="bg-white rounded p-3 mt-2 text-xs">
                      <div className="font-medium text-gray-800 mb-1">Bio 頁面網址格式：</div>
                      <div className="font-mono">go.smartmommy.com/<strong>@links</strong></div>
                      <div className="text-gray-400 mt-1">路徑前面加 @ 就是 Bio 頁面</div>
                    </div>
                  </div>
                </section>

                {/* 常見問題 */}
                <section>
                  <h3 className="text-base font-bold text-gray-800 mb-3">❓ 常見問題</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800 text-sm">Q：換了目標網址，之前發出去的短網址還能用嗎？</p>
                      <p className="text-sm text-gray-600 mt-1">A：可以！短網址不變，只是導向的目的地換了。已印出的 QR Code 也照常使用。</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800 text-sm">Q：短碼可以用中文嗎？</p>
                      <p className="text-sm text-gray-600 mt-1">A：可以！例如 go.smartmommy.com/母親節 完全沒問題。</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800 text-sm">Q：一個網域可以建多少短網址？</p>
                      <p className="text-sm text-gray-600 mt-1">A：無上限，想建幾個就建幾個。</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800 text-sm">Q：可以同時用多個網域嗎？</p>
                      <p className="text-sm text-gray-600 mt-1">A：可以！每個網域獨立運作，不同網域可以有相同的短碼，導向不同目標。</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800 text-sm">Q：停用短網址後會怎樣？</p>
                      <p className="text-sm text-gray-600 mt-1">A：訪客會被導向首頁。隨時可以重新啟用。</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800 text-sm">Q：新增網域需要做幾件事？</p>
                      <p className="text-sm text-gray-600 mt-1">A：三件事 — ① DNS 加 CNAME ② Vercel 加網域 ③ 這裡加網域，缺一不可。</p>
                    </div>
                  </div>
                </section>

              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
