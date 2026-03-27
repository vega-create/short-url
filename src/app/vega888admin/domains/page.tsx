'use client'

import { useState, useEffect } from 'react'
import { Domain } from '@/lib/types'

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  const fetchDomains = async () => {
    const res = await fetch('/api/domains')
    const data = await res.json()
    setDomains(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchDomains() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newDomain.trim()) return

    const res = await fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: newDomain, name: newName }),
    })

    if (res.ok) {
      setNewDomain('')
      setNewName('')
      fetchDomains()
    } else {
      const data = await res.json()
      setError(data.error || '新增失敗')
    }
  }

  const handleDelete = async (id: string, domain: string) => {
    if (!confirm(`確定要刪除 ${domain}？\n該網域下的所有短網址和 Bio 頁面都會被刪除！`)) return

    const res = await fetch(`/api/domains/${id}`, { method: 'DELETE' })
    if (res.ok) fetchDomains()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">🌐 網域管理</h1>

      {/* 新增網域 */}
      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">新增網域</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">網域 / 子網域</label>
            <input
              type="text"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="go.mommywisdom.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註名稱</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="智慧媽咪主網域"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition font-medium text-sm"
            >
              + 新增網域
            </button>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>DNS 設定提醒：</strong>新增子網域後，請到 DNS 設定 CNAME 指向{' '}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">cname.vercel-dns.com</code>
            ，並在 Vercel 專案的 Domains 新增此網域。
          </p>
        </div>
      </form>

      {/* 網域列表 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">已設定網域</h2>
        </div>

        {loading ? (
          <div className="p-6 text-gray-500">載入中...</div>
        ) : domains.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">尚未新增任何網域</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {domains.map(domain => (
              <div key={domain.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="font-medium text-blue-800">{domain.domain}</div>
                  {domain.name && <div className="text-sm text-gray-500">{domain.name}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    建立時間：{new Date(domain.created_at).toLocaleString('zh-TW')}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(domain.id, domain.domain)}
                  className="text-sm text-red-500 hover:text-red-700 transition px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
