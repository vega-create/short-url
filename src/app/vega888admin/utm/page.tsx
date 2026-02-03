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

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/links')
    const data = await res.json()
    setLinks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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

  // 統計
  const withUtm = links.filter(l => l.utm_source || l.utm_medium || l.utm_campaign)
  const withRules = links.filter(l => l.param_utm_rules && l.param_utm_rules.length > 0)
  const noUtm = links.filter(l => !l.utm_source && !l.utm_medium && !l.utm_campaign)

  // 匯出 CSV
  const handleExport = () => {
    const header = '備註,網域,短碼,短網址,utm_source,utm_medium,utm_campaign,utm_term,utm_content,附加UTM,渠道規則數'
    const rows = links.map(link => {
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

      {/* 短網址列表 */}
      {links.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🏷️</div>
          <p className="text-gray-500">尚未建立任何短網址</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
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
                {links.map(link => {
                  const domain = (link.domains as Domain)?.domain || ''
                  const isEditing = !!editingUtm[link.id]
                  const utmData = editingUtm[link.id]
                  const hasUtm = link.utm_source || link.utm_medium || link.utm_campaign
                  const rules = link.param_utm_rules || []

                  return (
                    <tr key={link.id} className="hover:bg-gray-50 transition group">
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
                            <button
                              onClick={() => startEdit(link)}
                              className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition opacity-0 group-hover:opacity-100"
                            >
                              編輯
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}

                {/* 展開的渠道規則 */}
                {links.map(link => {
                  if (expandedId !== link.id) return null
                  const rules = link.param_utm_rules || []
                  if (rules.length === 0) return null
                  return (
                    <tr key={`rules-${link.id}`}>
                      <td colSpan={7} className="px-4 py-3 bg-blue-50">
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
