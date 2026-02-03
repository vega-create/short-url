import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// GET: 列出所有短網址
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const domainId = searchParams.get('domain_id')

  let query = supabaseAdmin
    .from('short_links')
    .select('*, domains(domain, name), link_targets(*), param_utm_rules(*)')
    .order('created_at', { ascending: false })

  if (domainId) {
    query = query.eq('domain_id', domainId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: 建立短網址
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const body = await request.json()
  const { domain_id, slug, name, target_url, pixel_id, gtm_id, ga_id, tags,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, append_utm } = body

  if (!domain_id || !slug || !target_url) {
    return NextResponse.json(
      { error: '網域、短碼、目標網址為必填' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('short_links')
    .insert({
      domain_id,
      slug: slug.trim(),
      name,
      target_url: target_url.trim(),
      pixel_id,
      gtm_id,
      ga_id,
      tags: tags || [],
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null,
      append_utm: append_utm || false,
    })
    .select('*, domains(domain)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '此網域下已有相同的短碼' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
