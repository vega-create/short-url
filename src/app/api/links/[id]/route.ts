import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// GET: 取得單一短網址
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('short_links')
    .select('*, domains(domain, name), link_targets(*), qr_settings(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT: 更新短網址
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { slug, name, target_url, is_active, use_ab_test, pixel_id, gtm_id, ga_id } = body

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (slug !== undefined) updateData.slug = slug.trim()
  if (name !== undefined) updateData.name = name
  if (target_url !== undefined) updateData.target_url = target_url.trim()
  if (is_active !== undefined) updateData.is_active = is_active
  if (use_ab_test !== undefined) updateData.use_ab_test = use_ab_test
  if (pixel_id !== undefined) updateData.pixel_id = pixel_id
  if (gtm_id !== undefined) updateData.gtm_id = gtm_id
  if (ga_id !== undefined) updateData.ga_id = ga_id

  const { data, error } = await supabaseAdmin
    .from('short_links')
    .update(updateData)
    .eq('id', id)
    .select('*, domains(domain, name), link_targets(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: 刪除短網址
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const { error } = await supabaseAdmin
    .from('short_links')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
