import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/auth'

// PUT: 更新連結
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { linkId } = await params
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('bio_links')
    .update(body)
    .eq('id', linkId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: 刪除連結
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { linkId } = await params
  const { error } = await supabaseAdmin
    .from('bio_links')
    .delete()
    .eq('id', linkId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
