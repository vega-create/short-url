'use client'

import { useState, useEffect, useCallback } from 'react'
import { Domain, BioPage, BioLink } from '@/lib/types'

type ViewMode = 'list' | 'create' | 'edit'

export default function BioManagePage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [pages, setPages] = useState<BioPage[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingPage, setEditingPage] = useState<BioPage | null>(null)

  const [form, setForm] = useState({
    domain_id: '',
    slug: '',
    title: '',
    bio: '',
    logo_url: '',
    theme: {
      bgColor: '#ffffff',
      textColor: '#000000',
      buttonColor: '#000000',
      buttonTextColor: '#ffffff',
      buttonStyle: 'rounded' as string,
      bgGradient: '',
      bgImage: '',
      bgOverlay: 'rgba(0,0,0,0.3)',
      fontFamily: 'Noto Sans TC' as string,
    },
  })
  const [formError, setFormError] = useState('')
  const [links, setLinks] = useState<BioLink[]>([])
  const [newLink, setNewLink] = useState({ title: '', url: '', icon: '', utm_source: '', utm_medium: '', utm_campaign: '' })
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editLink, setEditLink] = useState({ title: '', url: '', icon: '', utm_source: '', utm_medium: '', utm_campaign: '' })

  const fetchData = useCallback(async () => {
    const [domainsRes, pagesRes] = await Promise.all([
      fetch('/api/domains').then(r => r.json()),
      fetch('/api/bio').then(r => r.json()),
    ])
    setDomains(Array.isArray(domainsRes) ? domainsRes : [])
    setPages(Array.isArray(pagesRes) ? pagesRes : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setForm({
      domain_id: domains[0]?.id || '', slug: '', title: '', bio: '', logo_url: '',
      theme: { bgColor: '#ffffff', textColor: '#000000', buttonColor: '#000000', buttonTextColor: '#ffffff', buttonStyle: 'rounded', bgGradient: '', bgImage: '', bgOverlay: 'rgba(0,0,0,0.3)', fontFamily: 'Noto Sans TC' },
    })
    setLinks([])
    setFormError('')
  }

  const handleCreate = () => {
    resetForm()
    if (domains.length > 0) setForm(f => ({ ...f, domain_id: domains[0].id }))
    setViewMode('create')
  }

  const handleEdit = async (page: BioPage) => {
    const res = await fetch(`/api/bio/${page.id}`)
    const data = await res.json()
    setEditingPage(data)
    setForm({
      domain_id: data.domain_id,
      slug: data.slug,
      title: data.title || '',
      bio: data.bio || '',
      logo_url: data.logo_url || '',
      theme: { bgColor: '#ffffff', textColor: '#000000', buttonColor: '#000000', buttonTextColor: '#ffffff', buttonStyle: 'rounded', bgGradient: '', bgImage: '', bgOverlay: 'rgba(0,0,0,0.3)', fontFamily: 'Noto Sans TC', ...data.theme },
    })
    setLinks(data.bio_links || [])
    setViewMode('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.domain_id || !form.slug) { setFormError('網域和路徑為必填'); return }

    const isEdit = viewMode === 'edit' && editingPage
    const url = isEdit ? `/api/bio/${editingPage.id}` : '/api/bio'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      if (!isEdit) {
        const data = await res.json()
        setEditingPage(data)
        setViewMode('edit')
      } else {
        alert('已儲存')
      }
      fetchData()
    } else {
      const data = await res.json()
      setFormError(data.error || '操作失敗')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此 Bio 頁面？')) return
    await fetch(`/api/bio/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleAddLink = async () => {
    if (!editingPage || !newLink.title || !newLink.url) return
    const res = await fetch(`/api/bio/${editingPage.id}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLink),
    })
    if (res.ok) {
      const data = await res.json()
      setLinks([...links, data])
      setNewLink({ title: '', url: '', icon: '', utm_source: '', utm_medium: '', utm_campaign: '' })
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!editingPage) return
    await fetch(`/api/bio/${editingPage.id}/links/${linkId}`, { method: 'DELETE' })
    setLinks(links.filter(l => l.id !== linkId))
  }

  const handleSaveLink = async (linkId: string) => {
    if (!editingPage) return
    // 附加 UTM 到 URL
    let finalUrl = editLink.url
    if (editLink.utm_source || editLink.utm_medium || editLink.utm_campaign) {
      try {
        const urlObj = new URL(finalUrl)
        // 先清除舊的 UTM
        urlObj.searchParams.delete('utm_source')
        urlObj.searchParams.delete('utm_medium')
        urlObj.searchParams.delete('utm_campaign')
        if (editLink.utm_source) urlObj.searchParams.set('utm_source', editLink.utm_source)
        if (editLink.utm_medium) urlObj.searchParams.set('utm_medium', editLink.utm_medium)
        if (editLink.utm_campaign) urlObj.searchParams.set('utm_campaign', editLink.utm_campaign)
        finalUrl = urlObj.toString()
      } catch { /* ignore */ }
    }
    const res = await fetch(`/api/bio/${editingPage.id}/links/${linkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editLink.title, url: finalUrl, icon: editLink.icon }),
    })
    if (res.ok) {
      setLinks(links.map(l => l.id === linkId ? { ...l, title: editLink.title, url: finalUrl, icon: editLink.icon } : l))
      setEditingLinkId(null)
    }
  }

  const handleToggleLink = async (link: BioLink) => {
    if (!editingPage) return
    const res = await fetch(`/api/bio/${editingPage.id}/links/${link.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !link.is_active }),
    })
    if (res.ok) {
      setLinks(links.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l))
    }
  }

  const [copied, setCopied] = useState(false)

  // 字型選項
  const fontPresets = [
    { label: '思源黑體', value: 'Noto Sans TC', import: 'Noto+Sans+TC:wght@400;500;700' },
    { label: '思源宋體', value: 'Noto Serif TC', import: 'Noto+Serif+TC:wght@400;500;700' },
    { label: '圓體', value: 'Nunito', import: 'Nunito:wght@400;600;700' },
    { label: '手寫風', value: 'Kalam', import: 'Kalam:wght@400;700' },
    { label: 'Playfair', value: 'Playfair Display', import: 'Playfair+Display:wght@400;700' },
    { label: 'Poppins', value: 'Poppins', import: 'Poppins:wght@400;500;700' },
  ]

  // 動態載入 Google Font
  useEffect(() => {
    const font = fontPresets.find(f => f.value === form.theme.fontFamily)
    if (!font) return
    const linkId = 'bio-preview-font'
    let link = document.getElementById(linkId) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = `https://fonts.googleapis.com/css2?family=${font.import}&display=swap`
  }, [form.theme.fontFamily]) // eslint-disable-line react-hooks/exhaustive-deps

  // 預設漸層方案
  const gradientPresets = [
    { label: '無', value: '' },
    { label: '🌅 暖陽', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { label: '🌊 海洋', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { label: '🌿 森林', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { label: '🌸 櫻花', value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
    { label: '🔥 烈焰', value: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)' },
    { label: '🌙 夜空', value: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d2d6b 100%)' },
    { label: '🍑 蜜桃', value: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)' },
    { label: '💜 紫霞', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  ]

  if (loading) return <div className="text-gray-500">載入中...</div>

  if (domains.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🌐</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">尚未設定網域</h2>
        <p className="text-gray-500 mb-4">請先新增至少一個網域</p>
        <a href="/vega888admin/domains" className="inline-block bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm">
          前往設定網域
        </a>
      </div>
    )
  }

  // 新增/編輯
  if (viewMode === 'create' || viewMode === 'edit') {
    const isEdit = viewMode === 'edit'
    const currentDomain = domains.find(d => d.id === form.domain_id)
    const previewUrl = currentDomain ? `https://${currentDomain.domain}/@${form.slug}` : ''

    // 預覽背景
    const previewBg: React.CSSProperties = form.theme.bgImage
      ? { backgroundImage: `url(${form.theme.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : form.theme.bgGradient
        ? { background: form.theme.bgGradient }
        : { backgroundColor: form.theme.bgColor }

    return (
      <div>
        <button onClick={() => setViewMode('list')} className="text-sm text-red-600 hover:text-red-800 mb-4">← 返回列表</button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEdit ? '✏️ 編輯 Bio 頁面' : '➕ 新增 Bio 頁面'}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 設定欄 */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">基本設定</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">網域 *</label>
                    <select value={form.domain_id} onChange={e => setForm({ ...form, domain_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={isEdit}>
                      {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">路徑 *</label>
                    <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="links" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    {previewUrl && (
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-xs text-gray-400">{previewUrl}</p>
                        {isEdit && (
                          <button type="button" onClick={() => { navigator.clipboard.writeText(previewUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="text-xs text-red-500 hover:text-red-700">
                            {copied ? '✅ 已複製' : '📋 複製'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="智慧媽咪國際" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">簡介</label>
                  <input type="text" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="數位行銷 | 企業培訓" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo 圖片網址</label>
                  <input type="text" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              {/* === 背景設定 === */}
              <h3 className="text-md font-semibold text-gray-800 mt-6 mb-3">🎨 背景設定</h3>

              <div className="space-y-4">
                {/* 背景圖片 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">背景圖片網址</label>
                  <input type="text" value={form.theme.bgImage || ''} onChange={e => setForm({ ...form, theme: { ...form.theme, bgImage: e.target.value } })} placeholder="https://images.unsplash.com/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <p className="text-xs text-gray-400 mt-1">填入圖片網址後，背景色和漸層會被覆蓋</p>
                </div>

                {/* 背景圖遮罩 */}
                {form.theme.bgImage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景遮罩（讓文字更清楚）</label>
                    <select value={form.theme.bgOverlay || ''} onChange={e => setForm({ ...form, theme: { ...form.theme, bgOverlay: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">無遮罩</option>
                      <option value="rgba(0,0,0,0.2)">淺黑 20%</option>
                      <option value="rgba(0,0,0,0.3)">中黑 30%</option>
                      <option value="rgba(0,0,0,0.5)">深黑 50%</option>
                      <option value="rgba(255,255,255,0.3)">淺白 30%</option>
                      <option value="rgba(255,255,255,0.5)">中白 50%</option>
                    </select>
                  </div>
                )}

                {/* 漸層預設 */}
                {!form.theme.bgImage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">漸層背景（選一個或用純色）</label>
                    <div className="grid grid-cols-3 gap-2">
                      {gradientPresets.map(p => (
                        <button
                          type="button"
                          key={p.label}
                          onClick={() => setForm({ ...form, theme: { ...form.theme, bgGradient: p.value } })}
                          className={`p-2 rounded-lg text-xs text-center border-2 transition ${form.theme.bgGradient === p.value ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="w-full h-8 rounded-md mb-1" style={{ background: p.value || form.theme.bgColor }} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 純色背景 */}
                {!form.theme.bgImage && !form.theme.bgGradient && (
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.theme.bgColor} onChange={e => setForm({ ...form, theme: { ...form.theme, bgColor: e.target.value } })} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs text-gray-500">純色背景</span>
                  </div>
                )}
              </div>

              {/* === 文字 & 按鈕配色 === */}
              <h3 className="text-md font-semibold text-gray-800 mt-6 mb-3">✏️ 文字 & 按鈕</h3>

              <div className="space-y-4">
                {/* 字型選擇 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">字型</label>
                  <div className="grid grid-cols-3 gap-2">
                    {fontPresets.map(f => (
                      <button
                        type="button"
                        key={f.value}
                        onClick={() => setForm({ ...form, theme: { ...form.theme, fontFamily: f.value } })}
                        className={`p-2 rounded-lg text-center border-2 transition ${form.theme.fontFamily === f.value ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className="text-base mb-0.5" style={{ fontFamily: f.value }}>Aa 字</div>
                        <div className="text-xs text-gray-500">{f.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.theme.textColor} onChange={e => setForm({ ...form, theme: { ...form.theme, textColor: e.target.value } })} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs text-gray-500">文字色</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.theme.buttonColor} onChange={e => setForm({ ...form, theme: { ...form.theme, buttonColor: e.target.value } })} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs text-gray-500">按鈕色</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.theme.buttonTextColor} onChange={e => setForm({ ...form, theme: { ...form.theme, buttonTextColor: e.target.value } })} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs text-gray-500">按鈕文字</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">按鈕樣式</label>
                  <select value={form.theme.buttonStyle} onChange={e => setForm({ ...form, theme: { ...form.theme, buttonStyle: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="rounded">圓角</option>
                    <option value="pill">膠囊</option>
                    <option value="square">方形</option>
                    <option value="outline">外框</option>
                    <option value="glass">毛玻璃</option>
                  </select>
                </div>
              </div>

              {formError && <p className="text-red-500 text-sm mt-3">{formError}</p>}
              <button type="submit" className="mt-6 w-full bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm">
                {isEdit ? '💾 儲存變更' : '🚀 建立頁面'}
              </button>
            </form>

            {/* 連結管理（僅編輯時） */}
            {isEdit && editingPage && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">📎 連結列表</h2>
                <p className="text-xs text-gray-400 mb-4">連結數量無上限，想加多少就加多少</p>

                {links.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {links.map(link => (
                      <div key={link.id} className="p-3 bg-gray-50 rounded-lg">
                        {editingLinkId === link.id ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input type="text" value={editLink.icon} onChange={e => setEditLink({ ...editLink, icon: e.target.value })} className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                              <input type="text" value={editLink.title} onChange={e => setEditLink({ ...editLink, title: e.target.value })} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <input type="url" value={editLink.url} onChange={e => setEditLink({ ...editLink, url: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                            <div className="flex gap-2">
                              <input type="text" value={editLink.utm_source} onChange={e => setEditLink({ ...editLink, utm_source: e.target.value })} placeholder="utm_source" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" />
                              <input type="text" value={editLink.utm_medium} onChange={e => setEditLink({ ...editLink, utm_medium: e.target.value })} placeholder="utm_medium" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" />
                              <input type="text" value={editLink.utm_campaign} onChange={e => setEditLink({ ...editLink, utm_campaign: e.target.value })} placeholder="utm_campaign" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveLink(link.id)} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">儲存</button>
                              <button onClick={() => setEditingLinkId(null)} className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">取消</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{link.icon || '🔗'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800">{link.title}</div>
                              <div className="text-xs text-gray-400 truncate">{link.url}</div>
                            </div>
                            <button onClick={() => {
                              // 從 URL 中提取現有 UTM
                              let cleanUrl = link.url
                              let us = '', um = '', uc = ''
                              try {
                                const u = new URL(link.url)
                                us = u.searchParams.get('utm_source') || ''
                                um = u.searchParams.get('utm_medium') || ''
                                uc = u.searchParams.get('utm_campaign') || ''
                                u.searchParams.delete('utm_source')
                                u.searchParams.delete('utm_medium')
                                u.searchParams.delete('utm_campaign')
                                cleanUrl = u.toString()
                              } catch { /* ignore */ }
                              setEditingLinkId(link.id)
                              setEditLink({ title: link.title, url: cleanUrl, icon: link.icon || '', utm_source: us, utm_medium: um, utm_campaign: uc })
                            }} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">編輯</button>
                            <button onClick={() => handleToggleLink(link)} className={`text-xs px-2 py-1 rounded ${link.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                              {link.is_active ? '顯示' : '隱藏'}
                            </button>
                            <button onClick={() => handleDeleteLink(link.id)} className="text-red-500 hover:text-red-700 text-xs">刪除</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input type="text" value={newLink.icon} onChange={e => setNewLink({ ...newLink, icon: e.target.value })} placeholder="📞" className="w-14 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center" />
                    <input type="text" value={newLink.title} onChange={e => setNewLink({ ...newLink, title: e.target.value })} placeholder="按鈕文字" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <input type="url" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} placeholder="https://目標網址" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <button type="button" onClick={handleAddLink} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition whitespace-nowrap">
                      + 新增
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newLink.utm_source} onChange={e => setNewLink({ ...newLink, utm_source: e.target.value })} placeholder="utm_source" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" />
                    <input type="text" value={newLink.utm_medium} onChange={e => setNewLink({ ...newLink, utm_medium: e.target.value })} placeholder="utm_medium" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" />
                    <input type="text" value={newLink.utm_campaign} onChange={e => setNewLink({ ...newLink, utm_campaign: e.target.value })} placeholder="utm_campaign" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" />
                  </div>
                  <p className="text-xs text-gray-400">UTM 選填，填了會自動附加到目標網址</p>
                </div>
              </div>
            )}
          </div>

          {/* ===== 手機預覽 ===== */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-gray-900 rounded-[2.5rem] p-3 max-w-[320px] mx-auto shadow-2xl">
              <div className="rounded-[2rem] overflow-hidden relative" style={{ ...previewBg, minHeight: 520 }}>
                {/* 背景遮罩 */}
                {form.theme.bgImage && form.theme.bgOverlay && (
                  <div className="absolute inset-0 rounded-[2rem]" style={{ backgroundColor: form.theme.bgOverlay }} />
                )}

                <div className="relative p-6 pt-10 text-center" style={{ fontFamily: `'${form.theme.fontFamily}', sans-serif` }}>
                  {form.logo_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={form.logo_url} alt="Logo" className="w-20 h-20 rounded-full mx-auto mb-3 object-cover shadow-lg border-2 border-white/30" />
                  )}
                  {form.title && (
                    <h2 className="text-lg font-bold mb-1" style={{ color: form.theme.textColor }}>{form.title}</h2>
                  )}
                  {form.bio && (
                    <p className="text-sm mb-6" style={{ color: form.theme.textColor, opacity: 0.7 }}>{form.bio}</p>
                  )}

                  <div className="space-y-3">
                    {links.filter(l => l.is_active).map((link, i) => {
                      const borderRadius = form.theme.buttonStyle === 'pill' ? '9999px' : form.theme.buttonStyle === 'square' ? '4px' : '12px'
                      const isOutline = form.theme.buttonStyle === 'outline'
                      const isGlass = form.theme.buttonStyle === 'glass'
                      return (
                        <div
                          key={link.id}
                          className="w-full py-3.5 px-4 text-center text-sm font-medium transition-all duration-300 hover:scale-[1.02]"
                          style={{
                            borderRadius,
                            backgroundColor: isGlass ? 'rgba(255,255,255,0.15)' : isOutline ? 'transparent' : form.theme.buttonColor,
                            color: isGlass ? '#ffffff' : isOutline ? form.theme.buttonColor : form.theme.buttonTextColor,
                            border: isOutline ? `2px solid ${form.theme.buttonColor}` : 'none',
                            backdropFilter: isGlass ? 'blur(12px)' : 'none',
                            boxShadow: isGlass ? '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
                            animationDelay: `${i * 0.08}s`,
                          }}
                        >
                          {link.icon && <span className="mr-2">{link.icon}</span>}
                          {link.title}
                        </div>
                      )
                    })}
                    {links.filter(l => l.is_active).length === 0 && (
                      <div className="text-sm py-8" style={{ color: form.theme.textColor, opacity: 0.4 }}>
                        尚未新增連結
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // === 列表 ===
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📄 Bio 頁面管理</h1>
        <button onClick={handleCreate} className="bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm">
          + 新增 Bio 頁面
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-500">尚未建立任何 Bio 頁面</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(page => {
            const domain = (page.domains as Domain)?.domain || ''
            const linkCount = page.bio_links?.length || 0
            return (
              <div key={page.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-gray-800">{page.title || page.slug}</div>
                    <div className="text-sm text-gray-600">https://{domain}/@{page.slug}</div>
                  </div>
                </div>
                {page.bio && <p className="text-sm text-gray-500 mb-3">{page.bio}</p>}
                <div className="text-xs text-gray-400 mb-3">{linkCount} 個連結</div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(page)} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition">
                    編輯
                  </button>
                  <a href={`https://${domain}/@${page.slug}`} target="_blank" className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                    預覽
                  </a>
                  <button onClick={() => handleDelete(page.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition">
                    刪除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
