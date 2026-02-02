import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// GET: 列出所有 Bio 頁面
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('bio_pages')
    .select('*, domains(domain, name), bio_links(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: 建立 Bio 頁面
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const body = await request.json()
  const { domain_id, slug, title, bio, logo_url, theme } = body

  if (!domain_id || !slug) {
    return NextResponse.json({ error: '網域和路徑為必填' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('bio_pages')
    .insert({ domain_id, slug: slug.trim(), title, bio, logo_url, theme })
    .select('*, domains(domain)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '此網域下已有相同的路徑' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
