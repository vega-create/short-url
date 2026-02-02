import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// GET: 列出某短網址的所有目標
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('link_targets')
    .select('*')
    .eq('short_link_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: 新增目標網址
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { target_url, weight, name } = body

  if (!target_url) {
    return NextResponse.json({ error: '目標網址為必填' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('link_targets')
    .insert({
      short_link_id: id,
      target_url: target_url.trim(),
      weight: weight || 1,
      name,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 自動啟用 A/B 分流
  await supabaseAdmin
    .from('short_links')
    .update({ use_ab_test: true })
    .eq('id', id)

  return NextResponse.json(data, { status: 201 })
}
