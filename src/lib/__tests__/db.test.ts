import { describe, it, expect, beforeAll } from 'vitest'
import { createFakeD1 } from './helpers/fakeD1'
import { db, __setBindingsForTest } from '../db'

// 用 node:sqlite 跑真正的 migrations/d1 schema，驗證相容層產出的 SQL 與 supabase-js 行為一致

beforeAll(() => {
  __setBindingsForTest({ DB: createFakeD1() })
})

describe('D1 相容層', () => {
  let domainId = ''
  let linkId = ''
  let bioId = ''

  it('insert 自動補 uuid、boolean/JSON 轉換、select 回傳物件', async () => {
    const { data: d, error } = await db.from('domains').insert({ domain: 'go.test', name: '測試' }).select().single()
    expect(error).toBeNull()
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(d.is_verified).toBe(false)
    expect(d.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    domainId = d.id

    const { data: l } = await db
      .from('short_links')
      .insert({ domain_id: domainId, slug: 'hello', target_url: 'https://example.com', tags: ['a', 'b'], force_external: true, external_platforms: undefined })
      .select('*, domains(domain)')
      .single()
    linkId = l.id
    expect(l.tags).toEqual(['a', 'b'])
    expect(l.external_platforms).toEqual(['facebook', 'instagram', 'threads', 'line'])
    expect(l.is_active).toBe(true)
    expect(l.force_external).toBe(true)
    expect(l.use_ab_test).toBe(false)
    expect(l.domains).toEqual({ domain: 'go.test' })
  })

  it('UNIQUE 衝突回 23505', async () => {
    const { error } = await db.from('short_links').insert({ domain_id: domainId, slug: 'hello', target_url: 'x' })
    expect(error?.code).toBe('23505')
  })

  it('巢狀關聯：to-one 物件、to-many 陣列、一對一 qr_settings、!inner + 關聯欄位條件', async () => {
    await db.from('link_targets').insert([
      { short_link_id: linkId, target_url: 'https://a', weight: 1, name: 'A' },
      { short_link_id: linkId, target_url: 'https://b', weight: 3, name: 'B' },
    ])
    await db.from('param_utm_rules').insert({ short_link_id: linkId, param_pattern: 'FB', utm_source: 'facebook' })

    const { data: link, error } = await db
      .from('short_links')
      .select(`*, domains!inner(domain), link_targets(*), param_utm_rules(*), qr_settings(*)`)
      .eq('domains.domain', 'go.test')
      .eq('slug', 'hello')
      .eq('is_active', true)
      .single()
    expect(error).toBeNull()
    expect(link.domains).toEqual({ domain: 'go.test' })
    expect(link.link_targets).toHaveLength(2)
    expect(link.link_targets[0].is_active).toBe(true)
    expect(link.param_utm_rules[0].utm_source).toBe('facebook')
    expect(link.qr_settings).toBeNull()

    // 網域不符 → 找不到（inner join 過濾）
    const miss = await db
      .from('short_links')
      .select(`*, domains!inner(domain)`)
      .eq('domains.domain', 'other.test')
      .eq('slug', 'hello')
      .single()
    expect(miss.data).toBeNull()
    expect(miss.error?.code).toBe('PGRST116')
  })

  it('upsert onConflict 只更新給的欄位、不換 id；qr_settings 以物件掛回 short_links', async () => {
    const a = await db.from('qr_settings').upsert({ short_link_id: linkId, fg_color: '#111111' }, { onConflict: 'short_link_id' }).select().single()
    const b = await db.from('qr_settings').upsert({ short_link_id: linkId, logo_url: 'https://logo' }, { onConflict: 'short_link_id' }).select().single()
    expect(b.data.id).toBe(a.data.id)
    expect(b.data.fg_color).toBe('#111111')
    expect(b.data.logo_url).toBe('https://logo')

    const { data } = await db.from('short_links').select('*, domains(domain), qr_settings(*)').eq('id', linkId).single()
    expect(data.qr_settings.fg_color).toBe('#111111')
  })

  it('update + select 巢狀、count head、or()、order referencedTable、三層巢狀', async () => {
    const { data: upd } = await db
      .from('short_links')
      .update({ name: '改名', updated_at: new Date().toISOString() })
      .eq('id', linkId)
      .select('*, domains(domain, name), link_targets(*)')
      .single()
    expect(upd.name).toBe('改名')
    expect(upd.domains).toEqual({ domain: 'go.test', name: '測試' })
    expect(upd.link_targets).toHaveLength(2)

    await db.from('click_logs').insert([
      { short_link_id: linkId, ip: '1.1.1.1', stage: 'landing' },
      { short_link_id: linkId, ip: '1.1.1.1', stage: null },
      { short_link_id: linkId, ip: '2.2.2.2', stage: 'escaped' },
      { short_link_id: linkId, ip: '3.3.3.3', stage: 'bot' },
    ])
    const { count } = await db
      .from('click_logs')
      .select('*', { count: 'exact', head: true })
      .eq('short_link_id', linkId)
      .or('stage.is.null,stage.eq.landing')
    expect(count).toBe(2)

    const { data: logs } = await db
      .from('click_logs')
      .select(`
        *,
        short_links(slug, name, target_url, domains(domain))
      `)
      .order('clicked_at', { ascending: false })
      .limit(5000)
    expect(logs).toHaveLength(4)
    expect(logs[0].short_links).toEqual({ slug: 'hello', name: '改名', target_url: 'https://example.com', domains: { domain: 'go.test' } })

    const { data: ips } = await db.from('click_logs').select('short_link_id, ip').or('stage.is.null,stage.eq.landing')
    expect(ips).toEqual([
      { short_link_id: linkId, ip: '1.1.1.1' },
      { short_link_id: linkId, ip: '1.1.1.1' },
    ])

    // bio
    const { data: bio } = await db
      .from('bio_pages')
      .insert({ domain_id: domainId, slug: 'links', title: 'Hi', theme: { bgColor: '#fff', buttonStyle: 'pill' } })
      .select('*, domains(domain)')
      .single()
    bioId = bio.id
    expect(bio.theme).toEqual({ bgColor: '#fff', buttonStyle: 'pill' })
    await db.from('bio_links').insert([
      { bio_page_id: bioId, title: 'B', url: 'https://b', sort_order: 2 },
      { bio_page_id: bioId, title: 'A', url: 'https://a', sort_order: 1 },
    ])
    const { data: page } = await db
      .from('bio_pages')
      .select('*, domains(domain, name), bio_links(*)')
      .eq('id', bioId)
      .order('sort_order', { referencedTable: 'bio_links', ascending: true })
      .single()
    expect(page.bio_links.map((l: { title: string }) => l.title)).toEqual(['A', 'B'])

    // maxOrder 寫法
    const { data: maxOrder } = await db.from('bio_links').select('sort_order').eq('bio_page_id', bioId).order('sort_order', { ascending: false }).limit(1).single()
    expect(maxOrder).toEqual({ sort_order: 2 })

    // 預設 theme
    const { data: bio2 } = await db.from('bio_pages').insert({ domain_id: domainId, slug: 'links2' }).select().single()
    expect(bio2.theme.buttonStyle).toBe('rounded')
  })

  it('in() 超過 90 個值會分批、delete 連帶 cascade', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ short_link_id: linkId, ip: `10.0.0.${i}`, stage: 'landing' }))
    await db.from('click_logs').insert(rows)
    const { data: all } = await db.from('click_logs').select('id').eq('short_link_id', linkId)
    expect(all).toHaveLength(254)
    const ids = all.map((r: { id: string }) => r.id).slice(0, 200)
    const { data: got } = await db.from('click_logs').select('id').in('id', ids)
    expect(got).toHaveLength(200)
    const { error } = await db.from('click_logs').delete().in('id', ids)
    expect(error).toBeNull()
    const { count } = await db.from('click_logs').select('*', { count: 'exact', head: true })
    expect(count).toBe(54)

    // 刪短網址 → link_targets / qr_settings / param_utm_rules cascade，click_logs set null
    await db.from('short_links').delete().eq('id', linkId)
    expect((await db.from('link_targets').select('*', { count: 'exact', head: true })).count).toBe(0)
    expect((await db.from('qr_settings').select('*', { count: 'exact', head: true })).count).toBe(0)
    const { data: orphan } = await db.from('click_logs').select('short_link_id').limit(1).single()
    expect(orphan.short_link_id).toBeNull()
  })

  it('slug 互擋：isSlugUsedBy 寫法（select id eq eq limit）', async () => {
    const { data } = await db.from('bio_pages').select('id').eq('domain_id', domainId).eq('slug', 'links').limit(1)
    expect(data.length).toBe(1)
    const { data: dom } = await db.from('bio_pages').select('domain_id').eq('id', bioId).single()
    expect(dom.domain_id).toBe(domainId)
  })
})
