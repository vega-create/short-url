'use client'

import { useState, useEffect, useCallback } from 'react'
import { Domain, ShortLink, LinkTarget, ParamUtmRule } from '@/lib/types'
import { buildShortUrl } from '@/lib/utils'

type ViewMode = 'list' | 'create' | 'edit' | 'qr'

export default function LinksPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingLink, setEditingLink] = useState<ShortLink | null>(null)
  const [filterDomain, setFilterDomain] = useState('')

  // 新增/編輯表單
  const [form, setForm] = useState({
    domain_id: '',
    slug: '',
    name: '',
    target_url: '',
    pixel_id: '',
    gtm_id: '',
    ga_id: '',
    tags: [] as string[],
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
    append_utm: false,
  })
  const [formError, setFormError] = useState('')
  const [tagInput, setTagInput] = useState('')

  // A/B 目標
  const [targets, setTargets] = useState<LinkTarget[]>([])
  const [newTarget, setNewTarget] = useState({ target_url: '', weight: 1, name: '' })

  // UTM 渠道對照表
  const [utmRules, setUtmRules] = useState<ParamUtmRule[]>([])
  const [newRule, setNewRule] = useState({ param_pattern: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '' })

  // 點擊統計
  const [clickStats, setClickStats] = useState<Record<string, { total: number; unique: number }>>({})

  // 分頁
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 10

  // 批量選取
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // UTM 產生器
  const [showUtm, setShowUtm] = useState<string | null>(null)
  const [utmParams, setUtmParams] = useState({ source: '', medium: '', campaign: '', term: '', content: '' })
  const fetchData = useCallback(async () => {
    const [domainsRes, linksRes, statsRes] = await Promise.all([
      fetch('/api/domains').then(r => r.json()),
      fetch('/api/links' + (filterDomain ? `?domain_id=${filterDomain}` : '')).then(r => r.json()),
      fetch('/api/clicks').then(r => r.json()).catch(() => []),
    ])
    setDomains(Array.isArray(domainsRes) ? domainsRes : [])
    setLinks(Array.isArray(linksRes) ? linksRes : [])
    
    // 整理統計數據
    const statsMap: Record<string, { total: number; unique: number }> = {}
    if (Array.isArray(statsRes)) {
      for (const s of statsRes) {
        statsMap[s.link_id] = { total: s.total, unique: s.unique }
      }
    }
    setClickStats(statsMap)
    
    setLoading(false)
  }, [filterDomain])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setForm({ domain_id: domains[0]?.id || '', slug: '', name: '', target_url: '', pixel_id: '', gtm_id: '', ga_id: '', tags: [], utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '', append_utm: false })
    setFormError('')
    setTagInput('')
    setTargets([])
    setNewTarget({ target_url: '', weight: 1, name: '' })
    setUtmRules([])
    setNewRule({ param_pattern: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '' })
  }

  const handleCreate = () => {
    resetForm()
    if (domains.length > 0) setForm(f => ({ ...f, domain_id: domains[0].id }))
    setViewMode('create')
  }

  const handleEdit = async (link: ShortLink) => {
    const res = await fetch(`/api/links/${link.id}`)
    const data = await res.json()
    setEditingLink(data)
    setForm({
      domain_id: data.domain_id,
      slug: data.slug,
      name: data.name || '',
      target_url: data.target_url,
      pixel_id: data.pixel_id || '',
      gtm_id: data.gtm_id || '',
      ga_id: data.ga_id || '',
      tags: data.tags || [],
      utm_source: data.utm_source || '',
      utm_medium: data.utm_medium || '',
      utm_campaign: data.utm_campaign || '',
      utm_term: data.utm_term || '',
      utm_content: data.utm_content || '',
      append_utm: data.append_utm || false,
    })
    setTargets(data.link_targets || [])
    setUtmRules(data.param_utm_rules || [])
    setViewMode('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!form.domain_id || !form.slug || !form.target_url) {
      setFormError('網域、短碼、目標網址為必填')
      return
    }

    // 重複短碼檢查
    const isEdit = viewMode === 'edit' && editingLink
    const duplicate = links.find(l => l.domain_id === form.domain_id && l.slug === form.slug.trim() && (!isEdit || l.id !== editingLink?.id))
    if (duplicate) {
      setFormError('⚠️ 此網域下已有相同的短碼「' + form.slug + '」，請換一個')
      return
    }

    const url = isEdit ? `/api/links/${editingLink.id}` : '/api/links'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setViewMode('list')
      fetchData()
    } else {
      const data = await res.json()
      setFormError(data.error || '操作失敗')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此短網址？')) return
    await fetch(`/api/links/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleToggleActive = async (link: ShortLink) => {
    await fetch(`/api/links/${link.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !link.is_active }),
    })
    fetchData()
  }

  // A/B 目標管理
  const handleAddTarget = async () => {
    if (!editingLink || !newTarget.target_url) return
    const res = await fetch(`/api/links/${editingLink.id}/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTarget),
    })
    if (res.ok) {
      const data = await res.json()
      setTargets([...targets, data])
      setNewTarget({ target_url: '', weight: 1, name: '' })
    }
  }

  const handleDeleteTarget = async (targetId: string) => {
    if (!editingLink) return
    await fetch(`/api/links/${editingLink.id}/targets/${targetId}`, { method: 'DELETE' })
    setTargets(targets.filter(t => t.id !== targetId))
  }

  // UTM 規則管理
  const handleAddUtmRule = async () => {
    if (!editingLink || !newRule.param_pattern) return
    const res = await fetch(`/api/links/${editingLink.id}/utm-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRule),
    })
    if (res.ok) {
      const data = await res.json()
      setUtmRules([...utmRules, data])
      setNewRule({ param_pattern: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '' })
    } else {
      const err = await res.json()
      alert(err.error || '新增失敗')
    }
  }

  const handleDeleteUtmRule = async (ruleId: string) => {
    if (!editingLink) return
    await fetch(`/api/links/${editingLink.id}/utm-rules?ruleId=${ruleId}`, { method: 'DELETE' })
    setUtmRules(utmRules.filter(r => r.id !== ruleId))
  }

  // 常用來源快捷
  const quickSources = [
    { label: 'Facebook', source: 'facebook', medium: 'post' },
    { label: 'FB 廣告', source: 'facebook', medium: 'cpc' },
    { label: 'Instagram', source: 'instagram', medium: 'post' },
    { label: 'IG 限動', source: 'instagram', medium: 'story' },
    { label: 'LINE', source: 'line', medium: 'message' },
    { label: 'LINE 群組', source: 'line', medium: 'group' },
    { label: 'YouTube', source: 'youtube', medium: 'video' },
    { label: 'Google 廣告', source: 'google', medium: 'cpc' },
    { label: 'Email', source: 'email', medium: 'newsletter' },
    { label: '蝦皮', source: 'shopee', medium: 'shop' },
  ]

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('已複製！')
  }

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`確定要刪除選取的 ${selectedIds.size} 個短網址？`)) return
    for (const id of selectedIds) {
      await fetch(`/api/links/${id}`, { method: 'DELETE' })
    }
    setSelectedIds(new Set())
    setCurrentPage(1)
    fetchData()
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedLinks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedLinks.map(l => l.id)))
    }
  }

  // UTM 產生器
  const buildUtmUrl = (baseUrl: string) => {
    const params = new URLSearchParams()
    if (utmParams.source) params.set('utm_source', utmParams.source)
    if (utmParams.medium) params.set('utm_medium', utmParams.medium)
    if (utmParams.campaign) params.set('utm_campaign', utmParams.campaign)
    if (utmParams.term) params.set('utm_term', utmParams.term)
    if (utmParams.content) params.set('utm_content', utmParams.content)
    const qs = params.toString()
    if (!qs) return baseUrl
    return baseUrl + (baseUrl.includes('?') ? '&' : '?') + qs
  }

  // 匯出 CSV
  const handleExport = () => {
    const header = '備註,網域,短碼,短網址,目標網址,標籤,啟用,總點擊,不重複點擊'
    const rows = links.map(link => {
      const domain = (link.domains as Domain)?.domain || ''
      const fullUrl = buildShortUrl(domain, link.slug)
      const stats = clickStats[link.id]
      return [
        link.name || '',
        domain,
        link.slug,
        fullUrl,
        link.target_url,
        (link.tags || []).join(';'),
        link.is_active ? '是' : '否',
        stats?.total || 0,
        stats?.unique || 0,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = '\uFEFF' + header + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `短網址_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 分頁計算
  const totalPages = Math.ceil(links.length / perPage)
  const paginatedLinks = links.slice((currentPage - 1) * perPage, currentPage * perPage)

  // QR Code 頁面
  const [qrLink, setQrLink] = useState<ShortLink | null>(null)
  const [qrSettings, setQrSettings] = useState({ fg_color: '#000000', bg_color: '#ffffff', logo_url: '', bg_image_url: '' })
  const [uploading, setUploading] = useState(false)

  const showQr = async (link: ShortLink) => {
    const res = await fetch(`/api/links/${link.id}`)
    const data = await res.json()
    setQrLink(data)
    const qs = Array.isArray(data.qr_settings) ? data.qr_settings[0] : data.qr_settings
    if (qs) {
      setQrSettings({ fg_color: qs.fg_color || '#000000', bg_color: qs.bg_color || '#ffffff', logo_url: qs.logo_url || '', bg_image_url: qs.bg_image_url || '' })
    } else {
      setQrSettings({ fg_color: '#000000', bg_color: '#ffffff', logo_url: '', bg_image_url: '' })
    }
    setViewMode('qr')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'bg_image_url') => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setQrSettings(prev => ({ ...prev, [field]: data.url }))
      } else {
        alert('上傳失敗：' + (data.error || '未知錯誤'))
      }
    } catch {
      alert('上傳失敗')
    }
    setUploading(false)
  }

  const saveQrSettings = async () => {
    if (!qrLink) return
    await fetch(`/api/qr/${qrLink.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qrSettings),
    })
    alert('QR Code 設定已儲存')
  }

  // === 渲染 ===

  if (loading) return <div className="text-gray-500">載入中...</div>

  if (domains.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🌐</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">尚未設定網域</h2>
        <p className="text-gray-500 mb-4">請先新增至少一個網域才能建立短網址</p>
        <a href="/vega888admin/domains" className="inline-block bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm">
          前往設定網域
        </a>
      </div>
    )
  }

  // QR Code 頁面
  if (viewMode === 'qr' && qrLink) {
    const domain = (qrLink.domains as Domain)?.domain || ''
    const fullUrl = buildShortUrl(domain, qrLink.slug)
    const qrImageUrl = `/api/qr/${qrLink.id}?size=400&t=${Date.now()}`

    return (
      <div>
        <button onClick={() => setViewMode('list')} className="text-sm text-red-600 hover:text-red-800 mb-4 flex items-center gap-1">
          ← 返回列表
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📱 QR Code 設定</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 預覽 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">預覽</h2>
            <div className="inline-block p-4 bg-gray-50 rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
            </div>
            <div className="mt-4 text-sm text-gray-500">{fullUrl}</div>
            <div className="mt-4 flex gap-2 justify-center">
              <a
                href={qrImageUrl}
                download={`qr-${qrLink.slug}.png`}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition"
              >
                下載 PNG
              </a>
              <a
                href={`/api/qr/${qrLink.id}?format=svg`}
                download={`qr-${qrLink.slug}.svg`}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
              >
                下載 SVG
              </a>
            </div>
          </div>

          {/* 設定 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">樣式設定</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">前景色</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={qrSettings.fg_color} onChange={e => setQrSettings({ ...qrSettings, fg_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <input type="text" value={qrSettings.fg_color} onChange={e => setQrSettings({ ...qrSettings, fg_color: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">背景色</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={qrSettings.bg_color} onChange={e => setQrSettings({ ...qrSettings, bg_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <input type="text" value={qrSettings.bg_color} onChange={e => setQrSettings({ ...qrSettings, bg_color: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo 圖片</label>
                <div className="flex gap-2 items-center mb-1">
                  <input
                    type="text"
                    value={qrSettings.logo_url}
                    onChange={e => setQrSettings({ ...qrSettings, logo_url: e.target.value })}
                    placeholder="貼上圖片網址或上傳"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition whitespace-nowrap ${uploading ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {uploading ? '上傳中...' : '📁 上傳'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, 'logo_url')} disabled={uploading} />
                  </label>
                </div>
                {qrSettings.logo_url && (
                  <div className="flex items-center gap-2 mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrSettings.logo_url} alt="Logo" className="w-8 h-8 rounded object-cover" />
                    <button onClick={() => setQrSettings({ ...qrSettings, logo_url: '' })} className="text-xs text-red-500 hover:text-red-700">移除</button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Logo 會顯示在 QR Code 中央</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">背景底圖</label>
                <div className="flex gap-2 items-center mb-1">
                  <input
                    type="text"
                    value={qrSettings.bg_image_url}
                    onChange={e => setQrSettings({ ...qrSettings, bg_image_url: e.target.value })}
                    placeholder="貼上圖片網址或上傳"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition whitespace-nowrap ${uploading ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {uploading ? '上傳中...' : '📁 上傳'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, 'bg_image_url')} disabled={uploading} />
                  </label>
                </div>
                {qrSettings.bg_image_url && (
                  <div className="flex items-center gap-2 mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrSettings.bg_image_url} alt="背景圖" className="w-12 h-12 rounded object-cover" />
                    <button onClick={() => setQrSettings({ ...qrSettings, bg_image_url: '' })} className="text-xs text-red-500 hover:text-red-700">移除</button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">QR Code 會疊在這張底圖上（設定後背景色會被忽略）</p>
              </div>

              <button
                onClick={saveQrSettings}
                className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm"
              >
                儲存設定並更新 QR Code
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 新增/編輯表單
  if (viewMode === 'create' || viewMode === 'edit') {
    const isEdit = viewMode === 'edit'
    const currentDomain = domains.find(d => d.id === form.domain_id)

    return (
      <div>
        <button onClick={() => setViewMode('list')} className="text-sm text-red-600 hover:text-red-800 mb-4 flex items-center gap-1">
          ← 返回列表
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isEdit ? '✏️ 編輯短網址' : '➕ 新增短網址'}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">網域 *</label>
              <select
                value={form.domain_id}
                onChange={e => setForm({ ...form, domain_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                disabled={isEdit}
              >
                <option value="">選擇網域</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.domain}{d.name ? ` (${d.name})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">短碼 (slug) *</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                placeholder="母親節活動"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
              {currentDomain && form.slug && (
                <p className="text-xs text-gray-400 mt-1">
                  完整網址：https://{currentDomain.domain}/{form.slug}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目標網址 *</label>
              <input
                type="url"
                value={form.target_url}
                onChange={e => setForm({ ...form, target_url: e.target.value })}
                placeholder="https://你的landing-page.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註名稱</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="母親節活動 - Landing Page"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* 標籤 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">標籤</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tags: form.tags.filter((_, idx) => idx !== i) })}
                      className="text-gray-400 hover:text-red-500 ml-0.5"
                    >×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault()
                      if (!form.tags.includes(tagInput.trim())) {
                        setForm({ ...form, tags: [...form.tags, tagInput.trim()] })
                      }
                      setTagInput('')
                    }
                  }}
                  placeholder="輸入標籤後按 Enter"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
                      setForm({ ...form, tags: [...form.tags, tagInput.trim()] })
                    }
                    setTagInput('')
                  }}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
                >+ 新增</button>
              </div>
            </div>
          </div>

          {/* 追蹤碼設定（可收合） */}
          <details className="mb-4">
            <summary className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-800">
              📊 追蹤碼設定（選用）
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">FB Pixel ID</label>
                <input
                  type="text"
                  value={form.pixel_id}
                  onChange={e => setForm({ ...form, pixel_id: e.target.value })}
                  placeholder="123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GTM ID</label>
                <input
                  type="text"
                  value={form.gtm_id}
                  onChange={e => setForm({ ...form, gtm_id: e.target.value })}
                  placeholder="GTM-XXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GA4 ID</label>
                <input
                  type="text"
                  value={form.ga_id}
                  onChange={e => setForm({ ...form, ga_id: e.target.value })}
                  placeholder="G-XXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 ml-1">💡 有填追蹤碼的短網址，點擊時會先載入中間頁觸發追蹤碼（0.8秒），再跳轉。</p>
          </details>

          {/* UTM 設定（可收合） */}
          <details className="mb-4" open={!!(form.utm_source || form.utm_medium || form.utm_campaign)}>
            <summary className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-800">
              🏷️ UTM 追蹤設定（選用）
            </summary>
            <div className="mt-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              {/* 快捷選單 */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">⚡ 快速填入常用來源</label>
                <div className="flex flex-wrap gap-1.5">
                  {quickSources.map(qs => (
                    <button
                      key={qs.label}
                      type="button"
                      onClick={() => setForm({ ...form, utm_source: qs.source, utm_medium: qs.medium })}
                      className="text-xs px-2.5 py-1 bg-white border border-amber-300 text-amber-800 rounded-full hover:bg-amber-100 transition"
                    >
                      {qs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* UTM 欄位 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">utm_source <span className="text-gray-400">來源</span></label>
                  <input
                    type="text"
                    value={form.utm_source}
                    onChange={e => setForm({ ...form, utm_source: e.target.value })}
                    placeholder="facebook"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">utm_medium <span className="text-gray-400">媒介</span></label>
                  <input
                    type="text"
                    value={form.utm_medium}
                    onChange={e => setForm({ ...form, utm_medium: e.target.value })}
                    placeholder="post"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">utm_campaign <span className="text-gray-400">活動</span></label>
                  <input
                    type="text"
                    value={form.utm_campaign}
                    onChange={e => setForm({ ...form, utm_campaign: e.target.value })}
                    placeholder="母親節"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">utm_term <span className="text-gray-400">關鍵字（選填）</span></label>
                  <input
                    type="text"
                    value={form.utm_term}
                    onChange={e => setForm({ ...form, utm_term: e.target.value })}
                    placeholder="選填"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">utm_content <span className="text-gray-400">內容（選填）</span></label>
                  <input
                    type="text"
                    value={form.utm_content}
                    onChange={e => setForm({ ...form, utm_content: e.target.value })}
                    placeholder="選填"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* 附加 UTM 開關 */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.append_utm}
                    onChange={e => setForm({ ...form, append_utm: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
                <div>
                  <div className="text-sm font-medium text-gray-700">附加 UTM 到目標網址</div>
                  <div className="text-xs text-gray-400">開啟：跳轉時自動把 UTM 加到目標網址（適用目標是自己官網）</div>
                  <div className="text-xs text-gray-400">關閉：UTM 只用於中間頁追蹤碼觸發和後台統計（適用目標是 LINE/蝦皮等）</div>
                </div>
              </div>
            </div>
          </details>

          {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}

          <button type="submit" className="bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm">
            {isEdit ? '儲存變更' : '建立短網址'}
          </button>
        </form>

        {/* A/B 分流（僅編輯時） */}
        {isEdit && editingLink && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🔀 A/B 分流目標</h2>
            <p className="text-sm text-gray-500 mb-4">
              新增多個目標網址，系統會根據權重自動分配流量。不設定則直接使用上方的主目標網址。
            </p>

            {targets.length > 0 && (
              <div className="space-y-2 mb-4">
                {targets.map((t, i) => {
                  const totalWeight = targets.reduce((s, x) => s + x.weight, 0)
                  const pct = totalWeight > 0 ? Math.round((t.weight / totalWeight) * 100) : 0
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-bold text-gray-500 w-6">{String.fromCharCode(65 + i)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{t.target_url}</div>
                        {t.name && <div className="text-xs text-gray-500">{t.name}</div>}
                      </div>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        權重 {t.weight} ({pct}%)
                      </span>
                      <button
                        onClick={() => handleDeleteTarget(t.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        刪除
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input
                  type="url"
                  value={newTarget.target_url}
                  onChange={e => setNewTarget({ ...newTarget, target_url: e.target.value })}
                  placeholder="目標網址"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  value={newTarget.weight}
                  onChange={e => setNewTarget({ ...newTarget, weight: parseInt(e.target.value) || 1 })}
                  placeholder="權重"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="w-32">
                <input
                  type="text"
                  value={newTarget.name}
                  onChange={e => setNewTarget({ ...newTarget, name: e.target.value })}
                  placeholder="名稱"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleAddTarget}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition whitespace-nowrap"
              >
                + 新增
              </button>
            </div>
          </div>
        )}

        {/* 渠道 UTM 對照表（僅編輯時） */}
        {isEdit && editingLink && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">🗺️ 渠道 UTM 對照表</h2>
            <p className="text-sm text-gray-500 mb-4">
              讓不同路徑參數對應不同 UTM。例如：<code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600">/{form.slug}/FB</code> → facebook/post、<code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600">/{form.slug}/IG</code> → instagram/post
            </p>

            {utmRules.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">路徑參數</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">source</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">medium</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">campaign</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {utmRules.map(rule => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">/{rule.param_pattern}</code>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{rule.utm_source || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{rule.utm_medium || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{rule.utm_campaign || '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleDeleteUtmRule(rule.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 快捷填入 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">⚡ 快速填入</label>
              <div className="flex flex-wrap gap-1.5">
                {quickSources.map(qs => (
                  <button
                    key={qs.label}
                    type="button"
                    onClick={() => setNewRule({ ...newRule, utm_source: qs.source, utm_medium: qs.medium })}
                    className="text-xs px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full hover:bg-amber-100 transition"
                  >
                    {qs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 新增規則 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <input
                type="text"
                value={newRule.param_pattern}
                onChange={e => setNewRule({ ...newRule, param_pattern: e.target.value })}
                placeholder="路徑參數 (如 FB)"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={newRule.utm_source}
                onChange={e => setNewRule({ ...newRule, utm_source: e.target.value })}
                placeholder="source"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={newRule.utm_medium}
                onChange={e => setNewRule({ ...newRule, utm_medium: e.target.value })}
                placeholder="medium"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={newRule.utm_campaign}
                onChange={e => setNewRule({ ...newRule, utm_campaign: e.target.value })}
                placeholder="campaign"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                value={newRule.utm_term}
                onChange={e => setNewRule({ ...newRule, utm_term: e.target.value })}
                placeholder="term（選填）"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={handleAddUtmRule}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition whitespace-nowrap"
              >
                + 新增規則
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">💡 路徑參數會自動匹配最長的規則。例如「IG/限動」比「IG」優先。沒匹配到的用上方預設 UTM。</p>
          </div>
        )}
      </div>
    )
  }

  // === 列表頁面 ===
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🔗 短網址管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
          >
            📥 匯出 CSV
          </button>
          <button
            onClick={handleCreate}
            className="bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm"
          >
            + 新增短網址
          </button>
        </div>
      </div>

      {/* 篩選 + 批量操作 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {domains.length > 1 && (
            <select
              value={filterDomain}
              onChange={e => { setFilterDomain(e.target.value); setCurrentPage(1) }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">全部網域</option>
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.domain}</option>
              ))}
            </select>
          )}
          <span className="text-sm text-gray-500">共 {links.length} 筆</span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm hover:bg-red-200 transition"
          >
            🗑️ 刪除選取的 {selectedIds.size} 筆
          </button>
        )}
      </div>

      {/* 短網址列表 */}
      {links.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <p className="text-gray-500">尚未建立任何短網址</p>
        </div>
      ) : (
        <>
          {/* 全選 */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <input
              type="checkbox"
              checked={selectedIds.size === paginatedLinks.length && paginatedLinks.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-xs text-gray-500">全選本頁</span>
          </div>

          <div className="space-y-3">
            {paginatedLinks.map(link => {
              const domain = (link.domains as Domain)?.domain || ''
              const fullUrl = buildShortUrl(domain, link.slug)
              return (
                <div key={link.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(link.id)}
                      onChange={() => toggleSelect(link.id)}
                      className="w-4 h-4 rounded border-gray-300 mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${link.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className="font-medium text-gray-800">{link.name || link.slug}</span>
                        {link.use_ab_test && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">A/B</span>
                        )}
                        {link.utm_source && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">UTM</span>
                        )}
                        {(link.param_utm_rules && link.param_utm_rules.length > 0) && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">渠道×{link.param_utm_rules.length}</span>
                        )}
                      </div>
                      <a href={fullUrl} target="_blank" rel="noopener" className="text-sm text-blue-800 hover:underline truncate block mb-1">
                        {fullUrl}
                      </a>
                      <div className="text-xs text-gray-400 truncate">
                        → {link.target_url}
                      </div>
                      {link.tags && link.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {link.tags.map((tag, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                      {(clickStats[link.id]?.total ?? 0) > 0 && (
                        <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                          <span>👆 點擊 <strong className="text-gray-700">{clickStats[link.id].total}</strong> 次</span>
                          <span>👤 不重複 <strong className="text-gray-700">{clickStats[link.id].unique}</strong></span>
                        </div>
                      )}

                      {/* UTM 產生器 */}
                      {showUtm === link.id && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                            <input
                              type="text" placeholder="utm_source（如 facebook）" value={utmParams.source}
                              onChange={e => setUtmParams({ ...utmParams, source: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                            />
                            <input
                              type="text" placeholder="utm_medium（如 post）" value={utmParams.medium}
                              onChange={e => setUtmParams({ ...utmParams, medium: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                            />
                            <input
                              type="text" placeholder="utm_campaign（如 母親節）" value={utmParams.campaign}
                              onChange={e => setUtmParams({ ...utmParams, campaign: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                            />
                            <input
                              type="text" placeholder="utm_term（選填）" value={utmParams.term}
                              onChange={e => setUtmParams({ ...utmParams, term: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                            />
                            <input
                              type="text" placeholder="utm_content（選填）" value={utmParams.content}
                              onChange={e => setUtmParams({ ...utmParams, content: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white px-2 py-1.5 rounded border text-xs text-gray-600 truncate">
                              {buildUtmUrl(link.target_url)}
                            </div>
                            <button
                              onClick={() => {
                                const utmUrl = buildUtmUrl(link.target_url)
                                copyToClipboard(utmUrl)
                              }}
                              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition whitespace-nowrap"
                            >
                              複製帶 UTM 網址
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">💡 複製後貼到目標網址欄位，就能在 GA4 追蹤來源。</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(fullUrl)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        複製
                      </button>
                      <button
                        onClick={() => {
                          if (showUtm === link.id) { setShowUtm(null) } else {
                            setShowUtm(link.id)
                            setUtmParams({ source: '', medium: '', campaign: '', term: '', content: '' })
                          }
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg transition ${showUtm === link.id ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        UTM
                      </button>
                      <button
                        onClick={() => showQr(link)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        QR
                      </button>
                      <button
                        onClick={() => handleToggleActive(link)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition ${
                          link.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {link.is_active ? '啟用中' : '已停用'}
                      </button>
                      <button
                        onClick={() => handleEdit(link)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm transition ${
                    page === currentPage ? 'bg-red-600 text-white' : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
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
