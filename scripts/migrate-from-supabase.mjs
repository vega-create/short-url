// scripts/migrate-from-supabase.mjs
// 一次性搬運：Supabase（Postgres，lbkrvy 專案裡短網址的 8 張表）→ Cloudflare D1。
// Storage bucket `uploads` 是空的，不用搬檔案。
//
// 用法（在專案目錄）：
//   node scripts/migrate-from-supabase.mjs <輸出資料夾>                  只匯出（JSON + data.sql）
//   node scripts/migrate-from-supabase.mjs <輸出資料夾> --apply local    匯出後寫進本機 D1（next dev 用）並核對筆數
//   node scripts/migrate-from-supabase.mjs <輸出資料夾> --apply remote   匯出後寫進正式 D1 並核對筆數
//   node scripts/migrate-from-supabase.mjs <輸出資料夾> --apply remote --skip-export   用既有匯出直接套用
//
// 金鑰：只讀 .env.local（或環境變數）的 SUPABASE_URL（或 NEXT_PUBLIC_SUPABASE_URL）/ SUPABASE_SERVICE_ROLE_KEY，
//       只放在 process.env 使用，絕不印出。對 Supabase 只做讀取，不改任何資料或 schema，
//       也只碰下面 TABLES 列出的 8 張表（lbkrvy 是和廣告報告系統共用的專案）。
// ⚠️ 輸出資料夾含點擊紀錄（IP、UA），請放在專案外、不要進 git。
// 可重跑：INSERT OR REPLACE（切換前再跑一次 --apply remote 同步新資料）。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const CWD = process.cwd()
const args = process.argv.slice(2)
const OUT = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--apply')
const APPLY = args.includes('--apply') ? args[args.indexOf('--apply') + 1] : null
const SKIP_EXPORT = args.includes('--skip-export')
if (!OUT || (APPLY && !['local', 'remote'].includes(APPLY))) {
  console.error('用法：node scripts/migrate-from-supabase.mjs <輸出資料夾> [--apply local|remote] [--skip-export]')
  process.exit(1)
}
const OUT_ABS = path.resolve(OUT.replace(/^~/, process.env.HOME ?? ''))
if (OUT_ABS === CWD || OUT_ABS.startsWith(CWD + path.sep)) {
  console.error('✗ 輸出資料夾請放在專案外（含點擊紀錄，不可進 git）')
  process.exit(1)
}

const D1_NAME = 'short-url'

// ── 與 migrations/d1/0001_init.sql 對齊的欄位清單 ─────────────────────
// 順序＝FK 相依順序（先父後子）。
const TABLES = {
  domains: ['id', 'domain', 'name', 'is_verified', 'created_at', 'updated_at'],
  short_links: [
    'id', 'domain_id', 'slug', 'name', 'target_url', 'is_active', 'use_ab_test',
    'pixel_id', 'gtm_id', 'ga_id', 'tags', 'append_utm',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'force_external', 'external_platforms', 'created_at', 'updated_at',
  ],
  link_targets: ['id', 'short_link_id', 'target_url', 'weight', 'name', 'is_active', 'created_at'],
  param_utm_rules: [
    'id', 'short_link_id', 'param_pattern', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'created_at',
  ],
  qr_settings: ['id', 'short_link_id', 'logo_url', 'bg_image_url', 'fg_color', 'bg_color', 'style', 'size', 'created_at'],
  bio_pages: ['id', 'domain_id', 'slug', 'title', 'bio', 'logo_url', 'theme', 'created_at', 'updated_at'],
  bio_links: ['id', 'bio_page_id', 'title', 'url', 'icon', 'sort_order', 'is_active', 'created_at'],
  click_logs: [
    'id', 'short_link_id', 'target_id', 'param', 'ip', 'user_agent', 'referer', 'country', 'device',
    'utm_source', 'utm_medium', 'utm_campaign', 'in_app', 'os', 'stage', 'clicked_at',
  ],
}
// timestamptz 欄位：統一轉成 ISO 8601 UTC（與 D1 預設 strftime 格式一致）
const TS_COLS = new Set(['created_at', 'updated_at', 'clicked_at'])
// NOT NULL 且有預設值的欄位：Supabase 舊資料若為 null，補預設
const DEFAULTS = {
  short_links: { tags: [], external_platforms: ['facebook', 'instagram', 'threads', 'line'], is_active: true, use_ab_test: false, append_utm: false, force_external: false },
  domains: { is_verified: false },
  link_targets: { weight: 1, is_active: true },
  qr_settings: { fg_color: '#000000', bg_color: '#ffffff', style: 'square', size: 400 },
  bio_pages: { theme: { bgColor: '#ffffff', textColor: '#000000', buttonColor: '#000000', buttonTextColor: '#ffffff', buttonStyle: 'rounded', bgGradient: '' } },
  bio_links: { sort_order: 0, is_active: true },
}

function loadEnv() {
  try {
    for (const line of readFileSync(path.join(CWD, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // 沒有 .env.local 就只靠環境變數
  }
}

function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'object') return sqlLit(JSON.stringify(v))
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function convert(table, col, v) {
  if ((v === null || v === undefined) && DEFAULTS[table]?.[col] !== undefined) v = DEFAULTS[table][col]
  if (v === null || v === undefined) return null
  if (TS_COLS.has(col) && typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? v : d.toISOString()
  }
  return v
}

function wrangler(cmdArgs) {
  const r = spawnSync('npx', ['wrangler', ...cmdArgs], {
    cwd: CWD, encoding: 'utf8', stdio: 'pipe', maxBuffer: 512 * 1024 * 1024,
  })
  if (r.status !== 0) {
    process.stderr.write((r.stdout || '') + (r.stderr || ''))
    throw new Error(`wrangler ${cmdArgs.slice(0, 3).join(' ')} … 失敗（exit ${r.status}）`)
  }
  return r.stdout
}

// ── 1) 匯出 ──────────────────────────────────────
async function exportAll() {
  loadEnv()
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ 缺 SUPABASE_URL（或 NEXT_PUBLIC_SUPABASE_URL）/ SUPABASE_SERVICE_ROLE_KEY（.env.local 或環境變數）')
    process.exit(1)
  }
  const base = url.replace(/\/$/, '')
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  // PostgREST 一次最多 1000 列，用 Range 分頁讀完（依 id 排序確保分頁穩定）
  async function readAll(table) {
    const rows = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const res = await fetch(`${base}/rest/v1/${table}?select=*&order=id.asc`, {
        headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
      })
      if (!res.ok && res.status !== 206) throw new Error(`讀 ${table} 失敗：HTTP ${res.status}`)
      const page = await res.json()
      rows.push(...page)
      if (page.length < PAGE) break
    }
    return rows
  }

  mkdirSync(path.join(OUT_ABS, 'tables'), { recursive: true })
  const sql = [
    '-- 由 scripts/migrate-from-supabase.mjs 產生；含點擊紀錄，不要進 git。',
    'PRAGMA foreign_keys = OFF;',
  ]
  const summary = {}
  for (const [table, cols] of Object.entries(TABLES)) {
    const rows = await readAll(table)
    writeFileSync(path.join(OUT_ABS, 'tables', `${table}.json`), JSON.stringify(rows, null, 2))
    for (const row of rows) {
      const vals = cols.map((c) => sqlLit(convert(table, c, row[c])))
      sql.push(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`)
    }
    summary[table] = rows.length
    console.log(`  ✓ ${table}: ${rows.length} 筆`)
  }
  writeFileSync(path.join(OUT_ABS, 'data.sql'), sql.join('\n') + '\n')
  writeFileSync(
    path.join(OUT_ABS, 'manifest.json'),
    JSON.stringify({ exported_at: new Date().toISOString(), source_host: new URL(base).host, tables: summary }, null, 2)
  )
}

// ── 2) 套用到 D1 並核對筆數 ────────────────────────
function apply(target) {
  const flag = target === 'remote' ? '--remote' : '--local'
  const sqlFile = path.join(OUT_ABS, 'data.sql')
  const manifestFile = path.join(OUT_ABS, 'manifest.json')
  if (!existsSync(sqlFile) || !existsSync(manifestFile)) throw new Error(`找不到 ${sqlFile}，請先匯出`)
  const expected = JSON.parse(readFileSync(manifestFile, 'utf8')).tables

  console.log(`\n→ D1 ${target}：執行 data.sql`)
  wrangler(['d1', 'execute', D1_NAME, flag, '--yes', '--file', sqlFile])
  console.log('  ✓ 資料表寫入完成')

  console.log(`\n→ 核對筆數（Supabase 匯出 vs D1 ${target}）`)
  // 用 scalar subquery，不用 UNION ALL（本機 miniflare 會噴 too many terms in compound SELECT）
  const counts = 'SELECT ' + Object.keys(TABLES).map((t) => `(SELECT COUNT(*) FROM ${t}) AS ${t}`).join(', ')
  const out = wrangler(['d1', 'execute', D1_NAME, flag, '--yes', '--json', '--command', counts])
  const actual = JSON.parse(out.slice(out.indexOf('[')))[0].results[0]
  let mismatch = 0
  for (const [t, n] of Object.entries(actual)) {
    const ok = n === expected[t]
    if (!ok) mismatch++
    console.log(`  ${ok ? '✓' : '✗'} ${t}: Supabase ${expected[t]} / D1 ${n}`)
  }
  if (mismatch) throw new Error(`${mismatch} 張表筆數不符`)
  console.log('  ✓ 全部筆數一致')
}

if (!SKIP_EXPORT) {
  console.log(`匯出 Supabase → ${OUT_ABS}\n`)
  await exportAll()
}
if (APPLY) apply(APPLY)
console.log('\n✓ 完成')
