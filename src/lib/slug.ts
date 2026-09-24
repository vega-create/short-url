import { supabaseAdmin } from './supabase'

/**
 * 短網址與 Bio 頁共用同一個網址空間（例如 aimom.vip/learn），
 * 同網域下不能同名，否則短網址會優先、Bio 頁會被蓋掉。
 * 用來在建立/修改時檢查「另一張表」有沒有人用了這個 slug。
 */
export async function isSlugUsedBy(
  table: 'short_links' | 'bio_pages',
  domainId: string,
  slug: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('domain_id', domainId)
    .eq('slug', slug.trim())
    .limit(1)

  return !!data && data.length > 0
}

/** 取得某筆資料的 domain_id（PUT 時 body 不一定帶 domain_id） */
export async function getDomainId(
  table: 'short_links' | 'bio_pages',
  id: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('domain_id')
    .eq('id', id)
    .single()

  return data?.domain_id ?? null
}
