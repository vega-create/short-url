// vitest 用：以 Node 內建 node:sqlite 模擬 Cloudflare D1 的 prepare / bind / all / first / run / batch，
// 讓 src/lib/db.ts 相容層能用真正的 SQLite 跑 migrations/d1 的 schema 做測試。
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { D1Database } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type Stmt = {
  bind: (...args: unknown[]) => Stmt
  all: <T>() => Promise<{ results: T[]; success: true; meta: any }>
  first: <T>(col?: string) => Promise<T | null>
  run: () => Promise<{ success: true; meta: { changes: number } }>
  raw: <T>() => Promise<T[]>
}

export function createFakeD1(): D1Database & { sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const schema = readFileSync(path.join(process.cwd(), 'migrations/d1/0001_init.sql'), 'utf8')
  sqlite.exec(schema)

  const prepare = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...a) => prepare(sql, a),
    all: async <T>() => {
      const results = sqlite.prepare(sql).all(...(args as any[])) as T[]
      return { results, success: true as const, meta: {} }
    },
    first: async <T>(col?: string) => {
      const row = sqlite.prepare(sql).get(...(args as any[])) as any
      if (!row) return null
      return (col ? row[col] : row) as T
    },
    run: async () => {
      const r = sqlite.prepare(sql).run(...(args as any[]))
      return { success: true as const, meta: { changes: Number(r.changes) } }
    },
    raw: async <T>() => sqlite.prepare(sql).all(...(args as any[])).map((r: any) => Object.values(r)) as T[],
  })

  const d1 = {
    sqlite,
    prepare: (sql: string) => prepare(sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec('BEGIN')
      try {
        const out = []
        for (const s of stmts) out.push(await s.all())
        sqlite.exec('COMMIT')
        return out
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql)
      return { count: 1, duration: 0 }
    },
    dump: async () => new ArrayBuffer(0),
    withSession: () => d1,
  }
  return d1 as unknown as D1Database & { sqlite: DatabaseSync }
}
