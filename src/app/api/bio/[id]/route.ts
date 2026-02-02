import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// GET
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('bio_pages')
    .select('*, domains(domain, name), bio_links(*)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'bio_links', ascending: true })
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('bio_pages')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, domains(domain, name), bio_links(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { id } = await params
  const { error } = await supabaseAdmin
    .from('bio_pages')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
