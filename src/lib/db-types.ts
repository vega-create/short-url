// src/lib/db-types.ts
// SQLite 沒有 boolean / jsonb / 陣列 / uuid，讀寫時由 src/lib/db.ts 依這份清單轉換：
//   BOOL_COLS：INTEGER 0/1 ↔ boolean
//   JSON_COLS：JSON 字串 ↔ 物件／陣列（Postgres 的 jsonb 與 text[]）
//   UUID_ID_TABLES：insert 沒給 id 時自動補 crypto.randomUUID()（對應 gen_random_uuid()）
//   RELATIONS：supabase-js 的巢狀 select（例：`*, domains(domain), link_targets(*)`）要靠這張表知道
//              怎麼 join。kind='one' 回物件（或 null）、'many' 回陣列。
// 新增表或欄位時記得補上，否則程式會拿到 0/1 或字串。

export const BOOL_COLS: Record<string, string[]> = {
  domains: ['is_verified'],
  short_links: ['is_active', 'use_ab_test', 'append_utm', 'force_external'],
  link_targets: ['is_active'],
  bio_links: ['is_active'],
}

export const JSON_COLS: Record<string, string[]> = {
  short_links: ['tags', 'external_platforms'],
  bio_pages: ['theme'],
}

export const UUID_ID_TABLES = new Set([
  'domains',
  'short_links',
  'link_targets',
  'param_utm_rules',
  'qr_settings',
  'bio_pages',
  'bio_links',
  'click_logs',
])

export type Relation = {
  table: string
  /** one：父表的 localKey 對到子表一筆（FK 在父表，或子表 FK 有 UNIQUE）；many：子表多筆 */
  kind: 'one' | 'many'
  /** 父表用來比對的欄位 */
  localKey: string
  /** 子表用來比對的欄位 */
  foreignKey: string
}

const one = (table: string, localKey: string, foreignKey = 'id'): Relation => ({ table, kind: 'one', localKey, foreignKey })
const many = (table: string, foreignKey: string, localKey = 'id'): Relation => ({ table, kind: 'many', localKey, foreignKey })

export const RELATIONS: Record<string, Record<string, Relation>> = {
  domains: {
    short_links: many('short_links', 'domain_id'),
    bio_pages: many('bio_pages', 'domain_id'),
  },
  short_links: {
    domains: one('domains', 'domain_id'),
    link_targets: many('link_targets', 'short_link_id'),
    param_utm_rules: many('param_utm_rules', 'short_link_id'),
    click_logs: many('click_logs', 'short_link_id'),
    // qr_settings.short_link_id 有 UNIQUE → PostgREST 視為一對一，回單一物件
    qr_settings: { table: 'qr_settings', kind: 'one', localKey: 'id', foreignKey: 'short_link_id' },
  },
  link_targets: {
    short_links: one('short_links', 'short_link_id'),
  },
  param_utm_rules: {
    short_links: one('short_links', 'short_link_id'),
  },
  qr_settings: {
    short_links: one('short_links', 'short_link_id'),
  },
  click_logs: {
    short_links: one('short_links', 'short_link_id'),
    link_targets: one('link_targets', 'target_id'),
  },
  bio_pages: {
    domains: one('domains', 'domain_id'),
    bio_links: many('bio_links', 'bio_page_id'),
  },
  bio_links: {
    bio_pages: one('bio_pages', 'bio_page_id'),
  },
}
