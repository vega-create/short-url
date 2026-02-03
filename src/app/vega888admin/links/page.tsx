'use client'

import { useState, useEffect, useCallback } from 'react'
import { Domain, ShortLink, LinkTarget } from '@/lib/types'
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
  })
  const [formError, setFormError] = useState('')
  const [tagInput, setTagInput] = useState('')

  // A/B 目標
  const [targets, setTargets] = useState<LinkTarget[]>([])
  const [newTarget, setNewTarget] = useState({ target_url: '', weight: 1, name: '' })

  const fetchData = useCallback(async () => {
    const [domainsRes, linksRes] = await Promise.all([
      fetch('/api/domains').then(r => r.json()),
      fetch('/api/links' + (filterDomain ? `?domain_id=${filterDomain}` : '')).then(r => r.json()),
    ])
    setDomains(Array.isArray(domainsRes) ? domainsRes : [])
    setLinks(Array.isArray(linksRes) ? linksRes : [])
    setLoading(false)
  }, [filterDomain])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setForm({ domain_id: domains[0]?.id || '', slug: '', name: '', target_url: '', pixel_id: '', gtm_id: '', ga_id: '', tags: [] })
    setFormError('')
    setTagInput('')
    setTargets([])
    setNewTarget({ target_url: '', weight: 1, name: '' })
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
    })
    setTargets(data.link_targets || [])
    setViewMode('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!form.domain_id || !form.slug || !form.target_url) {
      setFormError('網域、短碼、目標網址為必填')
      return
    }

    const isEdit = viewMode === 'edit' && editingLink
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('已複製！')
  }

  // QR Code 頁面
  const [qrLink, setQrLink] = useState<ShortLink | null>(null)
  const [qrSettings, setQrSettings] = useState({ fg_color: '#000000', bg_color: '#ffffff', logo_url: '' })

  const showQr = async (link: ShortLink) => {
    const res = await fetch(`/api/links/${link.id}`)
    const data = await res.json()
    setQrLink(data)
    const qs = Array.isArray(data.qr_settings) ? data.qr_settings[0] : data.qr_settings
    if (qs) {
      setQrSettings({ fg_color: qs.fg_color || '#000000', bg_color: qs.bg_color || '#ffffff', logo_url: qs.logo_url || '' })
    } else {
      setQrSettings({ fg_color: '#000000', bg_color: '#ffffff', logo_url: '' })
    }
    setViewMode('qr')
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo 圖片網址</label>
                <input
                  type="text"
                  value={qrSettings.logo_url}
                  onChange={e => setQrSettings({ ...qrSettings, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Logo 會顯示在 QR Code 中央</p>
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
      </div>
    )
  }

  // === 列表頁面 ===
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🔗 短網址管理</h1>
        <button
          onClick={handleCreate}
          className="bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm"
        >
          + 新增短網址
        </button>
      </div>

      {/* 網域篩選 */}
      {domains.length > 1 && (
        <div className="mb-4">
          <select
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">全部網域</option>
            {domains.map(d => (
              <option key={d.id} value={d.id}>{d.domain}</option>
            ))}
          </select>
        </div>
      )}

      {/* 短網址列表 */}
      {links.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <p className="text-gray-500">尚未建立任何短網址</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const domain = (link.domains as Domain)?.domain || ''
            const fullUrl = buildShortUrl(domain, link.slug)
            return (
              <div key={link.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${link.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="font-medium text-gray-800">{link.name || link.slug}</span>
                      {link.use_ab_test && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">A/B</span>
                      )}
                    </div>
                    <div className="text-sm text-blue-800 truncate mb-1">
                      {fullUrl}
                    </div>
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
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyToClipboard(fullUrl)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                    >
                      複製
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
      )}
    </div>
  )
}
