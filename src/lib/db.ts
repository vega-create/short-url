// src/lib/db.ts
// Cloudflare D1 相容層：模仿 supabase-js 的查詢寫法，讓既有 route 幾乎不用改。
//   from().select('*, domains(domain), link_targets(*)').eq().in().or().order().limit().single()/maybeSingle()
//   insert / upsert / update / delete（接 .select() 等於 RETURNING，也可帶巢狀關聯）
//   select(col, { count: 'exact', head: true }) → { count }
//   巢狀關聯（embedded resources）靠 db-types.ts 的 RELATIONS 描述，父列撈完後用 IN (...) 再查子表；
//   `domains!inner(domain)` + `.eq('domains.domain', host)` 轉成 EXISTS 子查詢過濾父列。
//   storage.from('uploads').upload() / getPublicUrl() → R2（檔案由 /api/files/[...key] 讀出）
// 回傳同樣的 { data, error, count } 形狀。轉換規則（清單在 db-types.ts）：
//   boolean ↔ INTEGER 0/1、JSON 欄位 ↔ 字串、uuid 由這裡補 crypto.randomUUID()。
//
// 綁定來源：OpenNext 的 getCloudflareContext().env（wrangler.jsonc 的 DB / BUCKET）。
//   - 部署：Workers 執行期自動注入
//   - 本機 next dev：next.config.ts 的 initOpenNextCloudflareForDev() 用 wrangler 的本機模擬
//     （.wrangler/state/v3）提供同樣的綁定
// ★ 綁定要在 request 時才拿得到，所以一律在呼叫時讀，不在模組頂層讀。

import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { BOOL_COLS, JSON_COLS, RELATIONS, UUID_ID_TABLES, type Relation } from './db-types'

export type CfBindings = { DB?: D1Database; BUCKET?: R2Bucket }

let testBindings: CfBindings | undefined
/** 測試用：直接指定綁定（vitest 以 node:sqlite 模擬 D1） */
export function __setBindingsForTest(b: CfBindings | undefined) {
  testBindings = b
}

function cfEnv(): CfBindings | undefined {
  if (testBindings) return testBindings
  try {
    return getCloudflareContext().env as unknown as CfBindings
  } catch {
    return undefined
  }
}

export function getD1(): D1Database {
  const db = cfEnv()?.DB
  if (!db) throw new Error('D1 binding "DB" 不存在：請確認 wrangler.jsonc 的 d1_databases 設定')
  return db
}

export function getR2(): R2Bucket {
  const b = cfEnv()?.BUCKET
  if (!b) throw new Error('R2 binding "BUCKET" 不存在：請確認 wrangler.jsonc 的 r2_buckets 設定')
  return b
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// 型別：R＝列型別（預設 any，與未帶 Database 型別參數的 supabase-js 一致），D＝data 的型別
//   select() → R[]、single() → R、maybeSingle() → R | null、insert/update/delete 未接 select() → null
export type DbError = { message: string; code?: string }
export type Result<T = any> = { data: T; error: DbError | null; count?: number | null }
type Row = Record<string, any>
type Filter = { sql: string; args: unknown[] }
/** 針對巢狀關聯的條件（`.eq('domains.domain', host)`） */
type EmbedFilter = { alias: string; col: string; cmp: string; args: unknown[] }
type Embed = { alias: string; name: string; inner: boolean; cols: string[]; embeds: Embed[] }
type Shape = { cols: string[]; embeds: Embed[] }

// D1 單一 statement 最多綁 100 個參數，IN (...) 超過就分批
const IN_CHUNK = 90

// 只允許安全的識別字，避免欄位名被拿來拼 SQL
function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`不合法的欄位／表名：${name}`)
  return name
}

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function toRow(table: string, obj: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (BOOL_COLS[table]?.includes(k)) out[k] = v === null ? null : v ? 1 : 0
    else if (JSON_COLS[table]?.includes(k)) out[k] = v === null ? null : JSON.stringify(v)
    else if (v instanceof Date) out[k] = v.toISOString()
    else if (typeof v === 'object' && v !== null) out[k] = JSON.stringify(v)
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0
    else out[k] = v
  }
  return out
}

function fromRow(table: string, row: Row | null): Row | null {
  if (!row) return row
  const out: Row = { ...row }
  for (const k of BOOL_COLS[table] ?? []) if (k in out && out[k] !== null) out[k] = Boolean(out[k])
  for (const k of JSON_COLS[table] ?? [])
    if (k in out && typeof out[k] === 'string') {
      try {
        out[k] = JSON.parse(out[k])
      } catch {
        out[k] = null
      }
    }
  return out
}

function toError(e: unknown): DbError {
  const msg = String((e as Error)?.message ?? e)
  const code = /UNIQUE constraint/i.test(msg) ? '23505' : /FOREIGN KEY constraint/i.test(msg) ? '23503' : undefined
  return { message: msg, code }
}

// ── select 字串解析：'*, domains!inner(domain, name), link_targets(*)' ──
function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

function parseSelect(s: string): Shape {
  const shape: Shape = { cols: [], embeds: [] }
  for (const part of splitTop(s)) {
    const m = part.match(/^(?:([A-Za-z_]\w*):)?([A-Za-z_]\w*)(!inner|!left)?\s*\(([\s\S]*)\)$/)
    if (m) {
      const inner = parseSelect(m[4])
      shape.embeds.push({ alias: m[1] ?? m[2], name: m[2], inner: m[3] === '!inner', cols: inner.cols, embeds: inner.embeds })
    } else {
      shape.cols.push(part === '*' ? '*' : ident(part))
    }
  }
  if (!shape.cols.length) shape.cols = ['*']
  return shape
}

function relationOf(table: string, name: string): Relation {
  const rel = RELATIONS[table]?.[name]
  if (!rel) throw new Error(`未定義的關聯：${table} → ${name}（請在 src/lib/db-types.ts 的 RELATIONS 補上）`)
  return rel
}

/** 只留使用者要的欄位（加上巢狀關聯的 alias） */
function project(row: Row, cols: string[], embeds: Embed[]): Row {
  if (cols.includes('*')) return row
  const out: Row = {}
  for (const c of cols) if (c in row) out[c] = row[c]
  for (const e of embeds) if (e.alias in row) out[e.alias] = row[e.alias]
  return out
}

class QueryBuilder<R = any, D = R[]> implements PromiseLike<Result<D>> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private shape: Shape = { cols: ['*'], embeds: [] }
  private countMode = false
  private headOnly = false
  private filters: Filter[] = []
  private embedFilters: EmbedFilter[] = []
  private bigIn: { col: string; values: unknown[] } | null = null
  private orders: string[] = []
  private embedOrders: Record<string, string[]> = {}
  private limitN: number | null = null
  private offsetN: number | null = null
  private singleRow = false
  private maybe = false
  private payload: unknown = null
  private returning = false
  private conflictCols = 'id'

  constructor(private table: string) {
    ident(table)
  }

  select(cols = '*', opts?: { count?: string; head?: boolean }): QueryBuilder<R, R[]> {
    this.shape = parseSelect(cols)
    if (this.op === 'select') {
      if (opts?.count) this.countMode = true
      if (opts?.head) this.headOnly = true
    } else this.returning = true // insert/update/upsert/delete 後的 .select() = RETURNING
    return this as unknown as QueryBuilder<R, R[]>
  }
  insert(v: unknown): QueryBuilder<R, null> {
    this.op = 'insert'
    this.payload = v
    return this as unknown as QueryBuilder<R, null>
  }
  upsert(v: unknown, opts?: { onConflict?: string }): QueryBuilder<R, null> {
    this.op = 'upsert'
    this.payload = v
    if (opts?.onConflict) this.conflictCols = opts.onConflict
    return this as unknown as QueryBuilder<R, null>
  }
  update(v: unknown): QueryBuilder<R, null> {
    this.op = 'update'
    this.payload = v
    return this as unknown as QueryBuilder<R, null>
  }
  delete(): QueryBuilder<R, null> {
    this.op = 'delete'
    return this as unknown as QueryBuilder<R, null>
  }

  // ── 條件 ──
  // 欄位名含 "." 代表巢狀關聯的欄位（'domains.domain'），轉成 EXISTS 子查詢
  private cond(c: string, cmp: string, args: unknown[]) {
    const dot = c.indexOf('.')
    if (dot > 0) {
      const alias = ident(c.slice(0, dot))
      const col = ident(c.slice(dot + 1))
      this.embedFilters.push({ alias, col, cmp, args })
      return this
    }
    return this.push(`${ident(c)} ${cmp}`, args)
  }
  eq(c: string, v: unknown) {
    return v === null ? this.cond(c, 'IS NULL', []) : this.cond(c, '= ?', [this.val(v)])
  }
  neq(c: string, v: unknown) {
    return v === null ? this.cond(c, 'IS NOT NULL', []) : this.cond(c, '!= ?', [this.val(v)])
  }
  is(c: string, v: unknown) {
    if (v === null) return this.cond(c, 'IS NULL', [])
    return this.cond(c, '= ?', [this.val(v)])
  }
  lt(c: string, v: unknown) {
    return this.cond(c, '< ?', [this.val(v)])
  }
  lte(c: string, v: unknown) {
    return this.cond(c, '<= ?', [this.val(v)])
  }
  gt(c: string, v: unknown) {
    return this.cond(c, '> ?', [this.val(v)])
  }
  gte(c: string, v: unknown) {
    return this.cond(c, '>= ?', [this.val(v)])
  }
  like(c: string, v: string) {
    return this.cond(c, 'LIKE ?', [v])
  }
  ilike(c: string, v: string) {
    return this.cond(c, 'LIKE ? COLLATE NOCASE', [v])
  }
  in(c: string, arr: unknown[]) {
    const col = ident(c)
    if (!arr.length) return this.push('0 = 1', [])
    const vals = arr.map((x) => this.val(x))
    if (vals.length > IN_CHUNK && !this.bigIn) {
      // 超過 D1 參數上限：執行時分批跑，結果合併
      this.bigIn = { col, values: vals }
      return this
    }
    return this.push(`${col} IN (${vals.map(() => '?').join(',')})`, vals)
  }
  /** supabase 的 .or('stage.is.null,stage.eq.landing') */
  or(expr: string) {
    const parts = splitTop(expr).map((p) => {
      const [rawCol, op, ...rest] = p.split('.')
      const col = ident(rawCol)
      const v = rest.join('.')
      if (op === 'is' && v === 'null') return { sql: `${col} IS NULL`, args: [] as unknown[] }
      if (op === 'not' && rest[0] === 'is' && rest[1] === 'null') return { sql: `${col} IS NOT NULL`, args: [] as unknown[] }
      if (op === 'is') return { sql: `${col} = ?`, args: [v === 'true' ? 1 : v === 'false' ? 0 : v] }
      if (op === 'ilike') return { sql: `${col} LIKE ? COLLATE NOCASE`, args: [v.replace(/\*/g, '%')] }
      if (op === 'like') return { sql: `${col} LIKE ?`, args: [v.replace(/\*/g, '%')] }
      if (op === 'in') return { sql: `${col} IN (${v.replace(/^\(|\)$/g, '').split(',').map(() => '?').join(',')})`, args: v.replace(/^\(|\)$/g, '').split(',') }
      const cmp: Record<string, string> = { eq: '=', neq: '!=', gte: '>=', lte: '<=', gt: '>', lt: '<' }
      if (op in cmp) return { sql: `${col} ${cmp[op]} ?`, args: [v] }
      throw new Error(`or() 不支援的運算子：${op}`)
    })
    return this.push('(' + parts.map((p) => p.sql).join(' OR ') + ')', parts.flatMap((p) => p.args))
  }
  order(c: string, opts?: { ascending?: boolean; referencedTable?: string; foreignTable?: string; nullsFirst?: boolean }) {
    const dir = opts?.ascending === false ? 'DESC' : 'ASC'
    const ref = opts?.referencedTable ?? opts?.foreignTable
    if (ref) (this.embedOrders[ident(ref)] ??= []).push(`${ident(c)} ${dir}`)
    else this.orders.push(`${ident(c)} ${dir}`)
    return this
  }
  limit(n: number, opts?: { referencedTable?: string; foreignTable?: string }) {
    if (opts?.referencedTable || opts?.foreignTable) return this // 巢狀 limit 不支援，略過（本專案沒用到）
    this.limitN = n
    return this
  }
  range(from: number, to: number) {
    this.offsetN = from
    this.limitN = to - from + 1
    return this
  }
  single(): QueryBuilder<R, R> {
    this.singleRow = true
    return this as unknown as QueryBuilder<R, R>
  }
  maybeSingle(): QueryBuilder<R, R | null> {
    this.singleRow = true
    this.maybe = true
    return this as unknown as QueryBuilder<R, R | null>
  }

  private val(v: unknown) {
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v instanceof Date) return v.toISOString()
    return v
  }
  private push(sql: string, args: unknown[]) {
    this.filters.push({ sql, args })
    return this
  }

  /** 巢狀關聯條件 → EXISTS 子查詢（!inner 沒帶條件也要過濾掉沒對到的父列） */
  private existsFilters(): Filter[] {
    const out: Filter[] = []
    const aliases = new Set<string>([
      ...this.embedFilters.map((f) => f.alias),
      ...this.shape.embeds.filter((e) => e.inner).map((e) => e.alias),
    ])
    for (const alias of aliases) {
      const embed = this.shape.embeds.find((e) => e.alias === alias)
      const rel = relationOf(this.table, embed?.name ?? alias)
      if (rel.table === this.table) throw new Error('不支援自我關聯的條件')
      const fs = this.embedFilters.filter((f) => f.alias === alias)
      let sql = `EXISTS (SELECT 1 FROM ${rel.table} WHERE ${rel.table}.${rel.foreignKey} = ${this.table}.${rel.localKey}`
      const args: unknown[] = []
      for (const f of fs) {
        sql += ` AND ${rel.table}.${f.col} ${f.cmp}`
        args.push(...f.args)
      }
      out.push({ sql: sql + ')', args })
    }
    return out
  }

  private where(inChunk?: unknown[]): { sql: string; args: unknown[] } {
    const fs = [...this.filters, ...this.existsFilters()]
    if (this.bigIn && inChunk) fs.push({ sql: `${this.bigIn.col} IN (${inChunk.map(() => '?').join(',')})`, args: inChunk })
    if (!fs.length) return { sql: '', args: [] }
    return { sql: ' WHERE ' + fs.map((f) => f.sql).join(' AND '), args: fs.flatMap((f) => f.args) }
  }

  /** 父列撈完後，依 RELATIONS 用 IN (...) 查子表並掛上去（可巢狀） */
  private async attach(db: D1Database, table: string, rows: Row[], embeds: Embed[], topLevel: boolean) {
    if (!rows.length) return
    for (const e of embeds) {
      const rel = relationOf(table, e.name)
      const keys = [...new Set(rows.map((r) => r[rel.localKey]).filter((v) => v !== null && v !== undefined))]
      const filters = topLevel ? this.embedFilters.filter((f) => f.alias === e.alias) : []
      const orders = topLevel ? this.embedOrders[e.alias] ?? [] : []
      const children: Row[] = []
      for (const chunk of chunks(keys, IN_CHUNK)) {
        let sql = `SELECT * FROM ${rel.table} WHERE ${rel.foreignKey} IN (${chunk.map(() => '?').join(',')})`
        const args: unknown[] = [...chunk]
        for (const f of filters) {
          sql += ` AND ${f.col} ${f.cmp}`
          args.push(...f.args)
        }
        if (orders.length) sql += ' ORDER BY ' + orders.join(', ')
        const r = await db.prepare(sql).bind(...args).all<Row>()
        for (const x of r.results ?? []) children.push(fromRow(rel.table, x)!)
      }
      await this.attach(db, rel.table, children, e.embeds, false)
      const groups = new Map<unknown, Row[]>()
      for (const c of children) {
        const k = c[rel.foreignKey]
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k)!.push(project(c, e.cols, e.embeds))
      }
      for (const r of rows) {
        const list = groups.get(r[rel.localKey]) ?? []
        r[e.alias] = rel.kind === 'one' ? list[0] ?? null : list
      }
    }
  }

  /** 父表要 SELECT 的欄位：使用者要的 + 巢狀關聯需要的 key（最後再 project 掉） */
  private parentCols(): string {
    if (this.shape.cols.includes('*')) return '*'
    const cols = new Set(this.shape.cols)
    for (const e of this.shape.embeds) cols.add(relationOf(this.table, e.name).localKey)
    return [...cols].join(', ')
  }

  private async finish(db: D1Database, rows: Row[]): Promise<Row[]> {
    await this.attach(db, this.table, rows, this.shape.embeds, true)
    return rows.map((r) => project(r, this.shape.cols, this.shape.embeds))
  }

  then<R1 = Result<D>, R2 = never>(
    onf?: ((v: Result<D>) => R1 | PromiseLike<R1>) | null,
    onr?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ) {
    return (this.run() as Promise<Result<D>>).then(onf, onr)
  }

  private notFound(): Result<any> {
    return this.maybe
      ? { data: null, error: null }
      : { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
  }

  // 有 bigIn 時分批執行同一段 SQL，回傳所有 results 串起來
  private async runChunked(db: D1Database, build: (w: { sql: string; args: unknown[] }) => { sql: string; args: unknown[] }): Promise<Row[]> {
    const parts = this.bigIn ? chunks(this.bigIn.values, IN_CHUNK) : [undefined]
    const out: Row[] = []
    for (const chunk of parts) {
      const { sql, args } = build(this.where(chunk))
      const r = await db.prepare(sql).bind(...args).all<Row>()
      out.push(...(r.results ?? []))
    }
    return out
  }

  private async run(): Promise<Result<any>> {
    try {
      const db = getD1()
      const t = this.table

      if (this.op === 'select') {
        if (this.countMode && this.headOnly) {
          let n = 0
          const parts = this.bigIn ? chunks(this.bigIn.values, IN_CHUNK) : [undefined]
          for (const chunk of parts) {
            const w = this.where(chunk)
            const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}${w.sql}`).bind(...w.args).first<{ n: number }>()
            n += r?.n ?? 0
          }
          return { data: null, error: null, count: n }
        }
        if (this.singleRow && this.limitN === null) this.limitN = 1
        const raw = await this.runChunked(db, (w) => {
          let sql = `SELECT ${this.parentCols()} FROM ${t}${w.sql}`
          if (this.orders.length) sql += ' ORDER BY ' + this.orders.join(', ')
          if (this.limitN !== null) sql += ` LIMIT ${Number(this.limitN)}`
          if (this.offsetN !== null) sql += ` OFFSET ${Number(this.offsetN)}`
          return { sql, args: w.args }
        })
        const rows = await this.finish(db, raw.map((x) => fromRow(t, x)!))
        if (this.singleRow) {
          if (!rows.length) return this.notFound()
          return { data: rows[0], error: null }
        }
        return { data: rows, error: null, count: this.countMode ? rows.length : null }
      }

      if (this.op === 'insert' || this.op === 'upsert') {
        const list = Array.isArray(this.payload) ? (this.payload as Row[]) : [this.payload as Row]
        const stmts = list.map((o) => {
          const row = toRow(t, o)
          if (UUID_ID_TABLES.has(t) && !('id' in row)) row.id = crypto.randomUUID()
          const keys = Object.keys(row).map(ident)
          let sql = `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
          if (this.op === 'upsert') {
            // 跟 PostgREST upsert 一樣：撞 key 只更新有給的欄位，其餘保留；主鍵 id 不覆蓋
            const conflict = this.conflictCols.split(',').map((s) => ident(s.trim()))
            const sets = keys.filter((k) => !conflict.includes(k) && k !== 'id')
            sql += sets.length
              ? ` ON CONFLICT(${conflict.join(', ')}) DO UPDATE SET ${sets.map((k) => `${k} = excluded.${k}`).join(', ')}`
              : ` ON CONFLICT(${conflict.join(', ')}) DO NOTHING`
          }
          sql += ' RETURNING *'
          return db.prepare(sql).bind(...keys.map((k) => row[k]))
        })
        // 多列一次 batch（同一交易），單列直接跑
        const results = stmts.length === 1 ? [await stmts[0].all<Row>()] : await db.batch<Row>(stmts)
        const rows = results.map((r) => fromRow(t, r.results?.[0] ?? null)).filter((x): x is Row => !!x)
        const out = this.returning ? await this.finish(db, rows) : rows
        if (this.singleRow) return out.length ? { data: out[0], error: null } : this.notFound()
        if (!this.returning) return { data: null, error: null }
        return { data: Array.isArray(this.payload) ? out : out[0] ?? null, error: null }
      }

      if (this.op === 'update') {
        const row = toRow(t, this.payload as Row)
        const keys = Object.keys(row).map(ident)
        if (!keys.length) return { data: this.singleRow ? null : this.returning ? [] : null, error: null }
        const raw = await this.runChunked(db, (w) => ({
          sql: `UPDATE ${t} SET ${keys.map((k) => `${k} = ?`).join(', ')}${w.sql} RETURNING *`,
          args: [...keys.map((k) => row[k]), ...w.args],
        }))
        const rows = this.returning || this.singleRow ? await this.finish(db, raw.map((x) => fromRow(t, x)!)) : []
        if (this.singleRow) return rows.length ? { data: rows[0], error: null } : this.notFound()
        return { data: this.returning ? rows : null, error: null }
      }

      if (this.op === 'delete') {
        const raw = await this.runChunked(db, (w) => ({ sql: `DELETE FROM ${t}${w.sql} RETURNING *`, args: w.args }))
        const rows = this.returning || this.singleRow ? await this.finish(db, raw.map((x) => fromRow(t, x)!)) : []
        if (this.singleRow) return rows.length ? { data: rows[0], error: null } : this.notFound()
        return { data: this.returning ? rows : null, error: null }
      }

      return { data: null, error: { message: 'unsupported op' } }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  }
}

// ── Storage（R2）相容層：supabaseAdmin.storage.from(bucket).upload / getPublicUrl ──
// R2 物件 key = `${bucket}/${path}`；公開網址走自家 /api/files/<key>（由 src/app/api/files/[...key]/route.ts 從 R2 讀出）
export const FILES_ROUTE_PREFIX = '/api/files/'

class StorageBucket {
  constructor(private bucket: string) {}
  key(path: string) {
    return `${this.bucket}/${path.replace(/^\/+/, '')}`
  }
  async upload(
    path: string,
    body: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    opts?: { contentType?: string; upsert?: boolean }
  ): Promise<Result<{ path: string } | null>> {
    try {
      const r2 = getR2()
      const key = this.key(path)
      if (opts?.upsert === false && (await r2.head(key))) return { data: null, error: { message: 'The resource already exists', code: '409' } }
      await r2.put(key, body as any, { httpMetadata: { contentType: opts?.contentType } })
      return { data: { path }, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  }
  /** 相對網址；要絕對網址請由呼叫端用 request 的 origin 接上去 */
  getPublicUrl(path: string) {
    return { data: { publicUrl: `${FILES_ROUTE_PREFIX}${this.key(path)}` } }
  }
  async remove(paths: string[]): Promise<Result<string[] | null>> {
    try {
      await getR2().delete(paths.map((p) => this.key(p)))
      return { data: paths, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  }
}

/** 網址若指向自家 /api/files/<key>，回傳 R2 key；否則 null（外部圖片要用 fetch） */
export function r2KeyFromUrl(url: string): string | null {
  try {
    const pathname = url.startsWith('/') ? url : new URL(url).pathname
    if (!pathname.startsWith(FILES_ROUTE_PREFIX)) return null
    return decodeURIComponent(pathname.slice(FILES_ROUTE_PREFIX.length))
  } catch {
    return null
  }
}

export const db = {
  from<R = any>(table: string) {
    return new QueryBuilder<R>(table)
  },
  storage: {
    from(bucket: string) {
      return new StorageBucket(bucket)
    },
  },
}
export type Db = typeof db

// 舊名稱：原本是 Supabase service-role client，現在直接指向 D1 相容層，route 只要改 import 路徑
export const supabaseAdmin = db
