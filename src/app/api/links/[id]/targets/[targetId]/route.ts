import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// PUT: 更新目標
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { targetId } = await params
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('link_targets')
    .update(body)
    .eq('id', targetId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: 刪除目標
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id, targetId } = await params
  const { error } = await supabaseAdmin
    .from('link_targets')
    .delete()
    .eq('id', targetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 檢查剩餘目標數量，若為 0 則關閉 A/B
  const { count } = await supabaseAdmin
    .from('link_targets')
    .select('*', { count: 'exact', head: true })
    .eq('short_link_id', id)

  if (count === 0) {
    await supabaseAdmin
      .from('short_links')
      .update({ use_ab_test: false })
      .eq('id', id)
  }

  return NextResponse.json({ success: true })
}
