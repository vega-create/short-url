import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// GET: 取得某短網址的所有 UTM 規則
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('param_utm_rules')
    .select('*')
    .eq('short_link_id', id)
    .order('param_pattern')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST: 新增 UTM 規則
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { param_pattern, utm_source, utm_medium, utm_campaign, utm_term, utm_content } = body

  if (!param_pattern) {
    return NextResponse.json({ error: '路徑參數為必填' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('param_utm_rules')
    .insert({
      short_link_id: id,
      param_pattern: param_pattern.trim(),
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '此路徑參數已存在' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// DELETE: 刪除 UTM 規則（用 query param ruleId）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  await params
  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('ruleId')

  if (!ruleId) {
    return NextResponse.json({ error: '缺少 ruleId' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('param_utm_rules')
    .delete()
    .eq('id', ruleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
