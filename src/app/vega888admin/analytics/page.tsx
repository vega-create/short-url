'use client'

import { useState, useEffect, useCallback } from 'react'

interface ClickLog {
  id: string
  short_link_id: string
  param: string | null
  ip: string
  user_agent: string
  referer: string
  device: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  clicked_at: string
  short_links?: {
    slug: string
    name: string
    target_url: string
    domains?: { domain: string }
  }
}

interface ShortLinkOption {
  id: string
  slug: string
  name: string
  domain: string
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<ClickLog[]>([])
  const [linkOptions, setLinkOptions] = useState<ShortLinkOption[]>([])
  const [loading, setLoading] = useState(true)

  // 篩選
  const [filterLink, setFilterLink] = useState('')
  const [filterDevice, setFilterDevice] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [searchParam, setSearchParam] = useState('')

  // 分頁
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [logsRes, linksRes] = await Promise.all([
      fetch('/api/analytics').then(r => r.json()).catch(() => []),
      fetch('/api/links').then(r => r.json()).catch(() => []),
    ])
    setLogs(Array.isArray(logsRes) ? logsRes : [])
    if (Array.isArray(linksRes)) {
      setLinkOptions(linksRes.map((l: Record<string, unknown>) => ({
        id: l.id as string,
        slug: l.slug as string,
        name: (l.name as string) || (l.slug as string),
        domain: ((l.domains as Record<string, string>)?.domain) || '',
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 篩選邏輯
  const filteredLogs = logs.filter(log => {
    if (filterLink && log.short_link_id !== filterLink) return false
    if (filterDevice && log.device !== filterDevice) return false
    if (searchParam && !(log.param || '').includes(searchParam)) return false
    if (filterDateFrom) {
      const from = new Date(filterDateFrom)
      if (new Date(log.clicked_at) < from) return false
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo + 'T23:59:59')
      if (new Date(log.clicked_at) > to) return false
    }
    return true
  })

  // 統計
  const totalClicks = filteredLogs.length
  const uniqueIps = new Set(filteredLogs.map(l => l.ip)).size
  const deviceStats = filteredLogs.reduce((acc, l) => {
    acc[l.device || 'unknown'] = (acc[l.device || 'unknown'] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const paramStats = filteredLogs.reduce((acc, l) => {
    const p = l.param || '（無參數）'
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // UTM 來源/媒介統計
  const sourceStats = filteredLogs.reduce((acc, l) => {
    if (l.utm_source) {
      const key = `${l.utm_source}/${l.utm_medium || '(none)'}`
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  // UTM 活動統計
  const campaignStats = filteredLogs.reduce((acc, l) => {
    if (l.utm_campaign) {
      acc[l.utm_campaign] = (acc[l.utm_campaign] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  // 分頁
  const totalPages = Math.ceil(filteredLogs.length / perPage)
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * perPage, currentPage * perPage)

  // 匯出
  const handleExport = () => {
    const header = '時間,短網址,網域,短碼,路徑參數,來源,媒介,活動,目標網址,裝置,IP'
    const rows = filteredLogs.map(log => {
      const link = linkOptions.find(l => l.id === log.short_link_id)
      return [
        new Date(log.clicked_at).toLocaleString('zh-TW'),
        link?.name || '',
        link?.domain || '',
        link?.slug || '',
        log.param || '',
        log.utm_source || '',
        log.utm_medium || '',
        log.utm_campaign || '',
        log.short_links?.target_url || '',
        log.device || '',
        log.ip || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `點擊記錄_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 取得短網址名稱
  const getLinkName = (id: string) => {
    const link = linkOptions.find(l => l.id === id)
    return link ? `${link.name} (${link.domain}/${link.slug})` : id
  }

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) return <div className="text-gray-500">載入中...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 點擊分析</h1>
        <button
          onClick={handleExport}
          className="bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm"
        >
          📥 匯出 CSV
        </button>
      </div>

      {/* 統計摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{totalClicks}</div>
          <div className="text-sm text-gray-500 mt-1">總點擊</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{uniqueIps}</div>
          <div className="text-sm text-gray-500 mt-1">不重複訪客</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-emerald-600">{deviceStats['mobile'] || 0}</div>
          <div className="text-sm text-gray-500 mt-1">手機點擊</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-violet-600">{deviceStats['desktop'] || 0}</div>
          <div className="text-sm text-gray-500 mt-1">電腦點擊</div>
        </div>
      </div>

      {/* 路徑參數統計 */}
      {Object.keys(paramStats).length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">🏷️ 路徑參數分佈</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(paramStats)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([param, count]) => (
                <span key={param} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-700">{param}</span>
                  <span className="font-bold text-red-600">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* UTM 來源/媒介統計 */}
      {Object.keys(sourceStats).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">📡 來源 / 媒介</h2>
            <div className="space-y-2">
              {Object.entries(sourceStats)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const pct = totalClicks > 0 ? Math.round((count / totalClicks) * 100) : 0
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm text-gray-700 truncate">{key}</span>
                          <span className="text-sm font-bold text-amber-600 ml-2">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {Object.keys(campaignStats).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">🎯 活動成效</h2>
              <div className="space-y-2">
                {Object.entries(campaignStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([campaign, count]) => {
                    const pct = totalClicks > 0 ? Math.round((count / totalClicks) * 100) : 0
                    return (
                      <div key={campaign} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm text-gray-700 truncate">{campaign}</span>
                            <span className="text-sm font-bold text-violet-600 ml-2">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 篩選 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            value={filterLink}
            onChange={e => { setFilterLink(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">全部短網址</option>
            {linkOptions.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.slug})</option>
            ))}
          </select>

          <select
            value={filterDevice}
            onChange={e => { setFilterDevice(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">全部裝置</option>
            <option value="mobile">手機</option>
            <option value="desktop">電腦</option>
            <option value="tablet">平板</option>
          </select>

          <input
            type="text"
            value={searchParam}
            onChange={e => { setSearchParam(e.target.value); setCurrentPage(1) }}
            placeholder="搜尋路徑參數..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />

          <input
            type="date"
            value={filterDateFrom}
            onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />

          <input
            type="date"
            value={filterDateTo}
            onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        {(filterLink || filterDevice || searchParam || filterDateFrom || filterDateTo) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">篩選中：{filteredLogs.length} 筆</span>
            <button
              onClick={() => { setFilterLink(''); setFilterDevice(''); setSearchParam(''); setFilterDateFrom(''); setFilterDateTo(''); setCurrentPage(1) }}
              className="text-xs text-red-600 hover:text-red-800"
            >
              清除篩選
            </button>
          </div>
        )}
      </div>

      {/* 點擊記錄表格 */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-gray-500">尚無點擊記錄</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">時間</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">短網址</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">路徑參數</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">來源/媒介</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">裝置</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(log.clicked_at)}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-800">{getLinkName(log.short_link_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.param ? (
                          <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">/{log.param}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.utm_source ? (
                          <span className="inline-block bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs">
                            {log.utm_source}/{log.utm_medium || '—'}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          log.device === 'mobile' ? 'bg-emerald-50 text-emerald-700' :
                          log.device === 'desktop' ? 'bg-violet-50 text-violet-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {log.device === 'mobile' ? '📱 手機' : log.device === 'desktop' ? '💻 電腦' : log.device === 'tablet' ? '📱 平板' : log.device || '未知'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                ← 上一頁
              </button>
              <span className="text-sm text-gray-500">
                第 {currentPage} / {totalPages} 頁
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                下一頁 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
