'use client'

import { useState, useEffect, useCallback } from 'react'
import { Domain, ShortLink, ParamUtmRule } from '@/lib/types'
import { buildShortUrl } from '@/lib/utils'

export default function UtmPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingUtm, setEditingUtm] = useState<Record<string, { utm_source: string; utm_medium: string; utm_campaign: string; utm_term: string; utm_content: string; append_utm: boolean }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  // 篩選
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'with' | 'without'>('all')
  const [searchText, setSearchText] = useState('')

  // 批量選取
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/links')
    const data = await res.json()
    setLinks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 篩選邏輯
  const filteredLinks = links.filter(link => {
    if (filterStatus === 'with' && !link.utm_source && !link.utm_medium && !link.utm_campaign) return false
    if (filterStatus === 'without' && (link.utm_source || link.utm_medium || link.utm_campaign)) return false
    if (searchText) {
      const text = searchText.toLowerCase()
      const domain = (link.domains as Domain)?.domain || ''
      if (
        !(link.name || '').toLowerCase().includes(text) &&
        !link.slug.toLowerCase().includes(text) &&
        !domain.toLowerCase().includes(text) &&
        !(link.utm_source || '').toLowerCase().includes(text) &&
        !(link.utm_medium || '').toLowerCase().includes(text) &&
        !(link.utm_campaign || '').toLowerCase().includes(text)
      ) return false
    }
    if (filterDateFrom) {
      if (new Date(link.created_at) < new Date(filterDateFrom)) return false
    }
    if (filterDateTo) {
      if (new Date(link.created_at) > new Date(filterDateTo + 'T23:59:59')) return false
    }
    return true
  })

  const startEdit = (link: ShortLink) => {
    setEditingUtm(prev => ({
      ...prev,
      [link.id]: {
        utm_source: link.utm_source || '',
        utm_medium: link.utm_medium || '',
        utm_campaign: link.utm_campaign || '',
        utm_term: link.utm_term || '',
        utm_content: link.utm_content || '',
        append_utm: link.append_utm || false,
      }
    }))
  }

  const saveUtm = async (linkId: string) => {
    const utmData = editingUtm[linkId]
    if (!utmData) return
    setSavingId(linkId)
    await fetch(`/api/links/${linkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(utmData),
    })
    setSavingId(null)
    setEditingUtm(prev => {
      const next = { ...prev }
      delete next[linkId]
      return next
    })
    fetchData()
  }

  const cancelEdit = (linkId: string) => {
    setEditingUtm(prev => {
      const next = { ...prev }
      delete next[linkId]
      return next
    })
  }

  // 清除單一短網址的 UTM
  const handleClearUtm = async (linkId: string) => {
    if (!confirm('確定要清除此短網址的 UTM 設定？')) return
    await fetch(`/api/links/${linkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_term: '',
        utm_content: '',
        append_utm: false,
      }),
    })
    fetchData()
  }

  // 批量清除 UTM
  const handleBatchClearUtm = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`確定要清除選取的 ${selectedIds.size} 筆短網址的 UTM 設定？`)) return
    for (const id of selectedIds) {
      await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utm_source: '',
          utm_medium: '',
          utm_campaign: '',
          utm_term: '',
          utm_content: '',
          append_utm: false,
        }),
      })
    }
    setSelectedIds(new Set())
    fetchData()
  }

  // 批量刪除短網址
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`⚠️ 確定要刪除選取的 ${selectedIds.size} 筆短網址？此操作無法復原！`)) return
    for (const id of selectedIds) {
      await fetch(`/api/links/${id}`, { method: 'DELETE' })
    }
    setSelectedIds(new Set())
    fetchData()
  }

  // 選取
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLinks.length && filteredLinks.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLinks.map(l => l.id)))
    }
  }

  // 統計
  const withUtm = links.filter(l => l.utm_source || l.utm_medium || l.utm_campaign)
  const withRules = links.filter(l => l.param_utm_rules && l.param_utm_rules.length > 0)
  const noUtm = links.filter(l => !l.utm_source && !l.utm_medium && !l.utm_campaign)

  // 匯出 CSV
  const handleExport = () => {
    const header = '備註,網域,短碼,短網址,utm_source,utm_medium,utm_campaign,utm_term,utm_content,附加UTM,渠道規則數'
    const rows = filteredLinks.map(link => {
      const domain = (link.domains as Domain)?.domain || ''
      const fullUrl = buildShortUrl(domain, link.slug)
      return [
        link.name || '',
        domain,
        link.slug,
        fullUrl,
        link.utm_source || '',
        link.utm_medium || '',
        link.utm_campaign || '',
        link.utm_term || '',
        link.utm_content || '',
        link.append_utm ? '是' : '否',
        link.param_utm_rules?.length || 0,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `UTM設定_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="text-gray-500">載入中...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🏷️ UTM 管理總表</h1>
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
          <div className="text-3xl font-bold text-gray-800">{links.length}</div>
          <div className="text-sm text-gray-500 mt-1">全部短網址</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-emerald-600">{withUtm.length}</div>
          <div className="text-sm text-gray-500 mt-1">已設定 UTM</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{withRules.length}</div>
          <div className="text-sm text-gray-500 mt-1">有渠道規則</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-amber-600">{noUtm.length}</div>
          <div className="text-sm text-gray-500 mt-1">未設定 UTM</div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜尋名稱/短碼/來源..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'with' | 'without')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">全部狀態</option>
            <option value="with">已設定 UTM</option>
            <option value="without">未設定 UTM</option>
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            title="建立日期起始"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            title="建立日期結束"
          />
          {(searchText || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setSearchText(''); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo('') }}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
            >
              ✕ 清除篩選
            </button>
          )}
        </div>
        {(searchText || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
          <div className="mt-2 text-xs text-gray-500">
            篩選結果：{filteredLinks.length} 筆
          </div>
        )}
      </div>

      {/* 批量操作列 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 bg-red-50 rounded-xl border border-red-200">
          <span className="text-sm font-medium text-red-700">已選取 {selectedIds.size} 筆</span>
          <button
            onClick={handleBatchClearUtm}
            className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded-lg text-sm hover:bg-amber-200 transition"
          >
            🧹 清除 UTM 設定
          </button>
          <button
            onClick={handleBatchDelete}
            className="bg-red-100 text-red-700 px-4 py-1.5 rounded-lg text-sm hover:bg-red-200 transition"
          >
            🗑️ 刪除短網址
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
          >
            取消選取
          </button>
        </div>
      )}

      {/* 短網址列表 */}
      {filteredLinks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🏷️</div>
          <p className="text-gray-500">
            {links.length === 0 ? '尚未建立任何短網址' : '沒有符合篩選條件的短網址'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredLinks.length > 0 && selectedIds.size === filteredLinks.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">短網址</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">medium</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">campaign</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">附加UTM</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">渠道</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLinks.map(link => {
                  const domain = (link.domains as Domain)?.domain || ''
                  const isEditing = !!editingUtm[link.id]
                  const utmData = editingUtm[link.id]
                  const rules = link.param_utm_rules || []

                  return (
                    <>
                      <tr key={link.id} className={`hover:bg-gray-50 transition group ${selectedIds.has(link.id) ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(link.id)}
                            onChange={() => toggleSelect(link.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{link.name || link.slug}</div>
                          <div className="text-xs text-gray-400">{domain}/{link.slug}</div>
                        </td>

                        {isEditing ? (
                          <>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={utmData.utm_source}
                                onChange={e => setEditingUtm(prev => ({ ...prev, [link.id]: { ...prev[link.id], utm_source: e.target.value } }))}
                                placeholder="source"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={utmData.utm_medium}
                                onChange={e => setEditingUtm(prev => ({ ...prev, [link.id]: { ...prev[link.id], utm_medium: e.target.value } }))}
                                placeholder="medium"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={utmData.utm_campaign}
                                onChange={e => setEditingUtm(prev => ({ ...prev, [link.id]: { ...prev[link.id], utm_campaign: e.target.value } }))}
                                placeholder="campaign"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={utmData.append_utm}
                                onChange={e => setEditingUtm(prev => ({ ...prev, [link.id]: { ...prev[link.id], append_utm: e.target.checked } }))}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-2 text-center text-gray-400">{rules.length}</td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveUtm(link.id)}
                                  disabled={savingId === link.id}
                                  className="text-xs px-2.5 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition disabled:opacity-50"
                                >
                                  {savingId === link.id ? '...' : '儲存'}
                                </button>
                                <button
                                  onClick={() => cancelEdit(link.id)}
                                  className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                                >
                                  取消
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              {link.utm_source ? (
                                <span className="text-gray-700">{link.utm_source}</span>
                              ) : (
                                <span className="text-amber-500">⚠️</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{link.utm_medium || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{link.utm_campaign || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {link.append_utm ? (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">開</span>
                              ) : (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">關</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {rules.length > 0 ? (
                                <button
                                  onClick={() => setExpandedId(expandedId === link.id ? null : link.id)}
                                  className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100 transition"
                                >
                                  {rules.length} 個 {expandedId === link.id ? '▲' : '▼'}
                                </button>
                              ) : (
                                <span className="text-gray-300">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  onClick={() => startEdit(link)}
                                  className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                                >
                                  編輯
                                </button>
                                {(link.utm_source || link.utm_medium || link.utm_campaign) && (
                                  <button
                                    onClick={() => handleClearUtm(link.id)}
                                    className="text-xs px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition"
                                  >
                                    清除
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>

                      {/* 展開的渠道規則 */}
                      {expandedId === link.id && rules.length > 0 && (
                        <tr key={`rules-${link.id}`}>
                          <td colSpan={8} className="px-4 py-3 bg-blue-50">
                            <div className="text-xs font-medium text-blue-700 mb-2">渠道 UTM 對照表：</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {rules.map((rule: ParamUtmRule) => (
                                <div key={rule.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-blue-100">
                                  <code className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">/{rule.param_pattern}</code>
                                  <span className="text-xs text-gray-500">→</span>
                                  <span className="text-xs text-gray-700">{rule.utm_source || '—'}/{rule.utm_medium || '—'}</span>
                                  {rule.utm_campaign && <span className="text-xs text-gray-400">({rule.utm_campaign})</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
