import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// POST: 新增連結
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // 取得最大 sort_order
  const { data: maxOrder } = await supabaseAdmin
    .from('bio_links')
    .select('sort_order')
    .eq('bio_page_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await supabaseAdmin
    .from('bio_links')
    .insert({
      bio_page_id: id,
      title: body.title,
      url: body.url,
      icon: body.icon,
      sort_order: (maxOrder?.sort_order || 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PUT: 重新排序
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const body = await request.json()
  const { order } = body // [{ id: 'xxx', sort_order: 0 }, ...]

  if (!order || !Array.isArray(order)) {
    return NextResponse.json({ error: '缺少排序資料' }, { status: 400 })
  }

  for (const item of order) {
    await supabaseAdmin
      .from('bio_links')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  }

  return NextResponse.json({ success: true })
}
