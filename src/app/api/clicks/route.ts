import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth'

// GET: 取得所有短網址的點擊統計
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const linkId = searchParams.get('link_id')

  if (linkId) {
    // 單一短網址
    const { count: total } = await supabaseAdmin
      .from('click_logs')
      .select('*', { count: 'exact', head: true })
      .eq('short_link_id', linkId)
      .or('stage.is.null,stage.eq.landing')

    const { data: uniqueData } = await supabaseAdmin
      .from('click_logs')
      .select('ip')
      .eq('short_link_id', linkId)
      .or('stage.is.null,stage.eq.landing')

    const uniqueIps = new Set(uniqueData?.map(d => d.ip) || [])

    return NextResponse.json({
      link_id: linkId,
      total: total || 0,
      unique: uniqueIps.size,
    })
  }

  // 全部短網址的統計
  // 只算第一次點擊：帶 _ext 回來的（escaped/stayed）和爬蟲不重複計；舊資料 stage 為 null 照算
  const { data: logs } = await supabaseAdmin
    .from('click_logs')
    .select('short_link_id, ip')
    .or('stage.is.null,stage.eq.landing')

  const stats: Record<string, { total: number; ips: Set<string> }> = {}

  for (const log of logs || []) {
    if (!log.short_link_id) continue
    if (!stats[log.short_link_id]) {
      stats[log.short_link_id] = { total: 0, ips: new Set() }
    }
    stats[log.short_link_id].total++
    stats[log.short_link_id].ips.add(log.ip)
  }

  const result = Object.entries(stats).map(([link_id, s]) => ({
    link_id,
    total: s.total,
    unique: s.ips.size,
  }))

  return NextResponse.json(result)
}
