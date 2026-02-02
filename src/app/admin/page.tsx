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
    { label: '網域數量', value: stats.domains, icon: '🌐', href: '/admin/domains', color: 'bg-red-50 text-red-700' },
    { label: '短網址數量', value: stats.links, icon: '🔗', href: '/admin/links', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Bio 頁面', value: stats.bioPages, icon: '📄', href: '/admin/bio', color: 'bg-violet-50 text-violet-700' },
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

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">快速開始</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/admin/domains"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="text-2xl">🌐</span>
                <div>
                  <div className="font-medium text-gray-800">新增網域</div>
                  <div className="text-sm text-gray-500">設定你的自訂網域或子網域</div>
                </div>
              </Link>
              <Link
                href="/admin/links"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="text-2xl">🔗</span>
                <div>
                  <div className="font-medium text-gray-800">建立短網址</div>
                  <div className="text-sm text-gray-500">建立新的短網址並設定目標</div>
                </div>
              </Link>
              <Link
                href="/admin/bio"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="text-2xl">📄</span>
                <div>
                  <div className="font-medium text-gray-800">建立 Bio 頁面</div>
                  <div className="text-sm text-gray-500">建立連結收集頁面</div>
                </div>
              </Link>
              <Link
                href="/admin/links"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="text-2xl">📱</span>
                <div>
                  <div className="font-medium text-gray-800">QR Code</div>
                  <div className="text-sm text-gray-500">為短網址產生品牌 QR Code</div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
