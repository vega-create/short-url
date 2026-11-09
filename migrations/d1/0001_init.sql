-- =============================================
-- 智慧媽咪短網址系統 - Cloudflare D1（SQLite）schema
-- 由 supabase/migrations/001～006 合併而來（2026-11 從 Supabase 搬到 D1）
-- =============================================
-- SQLite 與 Postgres 的差異，由 src/lib/db.ts 相容層處理：
--   uuid          → TEXT（insert 時由程式用 crypto.randomUUID() 補）
--   boolean       → INTEGER 0/1
--   jsonb / text[] → TEXT（JSON 字串）
--   timestamptz   → TEXT（ISO 8601 UTC，例：2026-11-09T01:23:45.678Z）
--   inet          → TEXT
-- 沒有 RLS（後台 API 自己用 ADMIN_PASSWORD cookie 驗證，重定向 route 只讀）。
-- D1 預設啟用 foreign_keys，ON DELETE CASCADE / SET NULL 都會生效。

-- 網域
CREATE TABLE IF NOT EXISTS domains (
  id          TEXT PRIMARY KEY,
  domain      TEXT NOT NULL UNIQUE,
  name        TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 短網址
CREATE TABLE IF NOT EXISTS short_links (
  id                 TEXT PRIMARY KEY,
  domain_id          TEXT REFERENCES domains(id) ON DELETE CASCADE,
  slug               TEXT NOT NULL,
  name               TEXT,
  target_url         TEXT NOT NULL,
  is_active          INTEGER NOT NULL DEFAULT 1,
  use_ab_test        INTEGER NOT NULL DEFAULT 0,
  pixel_id           TEXT,
  gtm_id             TEXT,
  ga_id              TEXT,
  tags               TEXT NOT NULL DEFAULT '[]',          -- JSON 陣列
  append_utm         INTEGER NOT NULL DEFAULT 0,
  utm_source         TEXT,
  utm_medium         TEXT,
  utm_campaign       TEXT,
  utm_term           TEXT,
  utm_content        TEXT,
  force_external     INTEGER NOT NULL DEFAULT 0,
  external_platforms TEXT NOT NULL DEFAULT '["facebook","instagram","threads","line"]', -- JSON 陣列
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (domain_id, slug)
);

-- 目標網址（A/B 分流）
CREATE TABLE IF NOT EXISTS link_targets (
  id            TEXT PRIMARY KEY,
  short_link_id TEXT REFERENCES short_links(id) ON DELETE CASCADE,
  target_url    TEXT NOT NULL,
  weight        INTEGER NOT NULL DEFAULT 1,
  name          TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 渠道 UTM 對照表
CREATE TABLE IF NOT EXISTS param_utm_rules (
  id            TEXT PRIMARY KEY,
  short_link_id TEXT REFERENCES short_links(id) ON DELETE CASCADE,
  param_pattern TEXT NOT NULL,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (short_link_id, param_pattern)
);

-- QR Code 設定（每個短網址一筆）
CREATE TABLE IF NOT EXISTS qr_settings (
  id            TEXT PRIMARY KEY,
  short_link_id TEXT UNIQUE REFERENCES short_links(id) ON DELETE CASCADE,
  logo_url      TEXT,
  bg_image_url  TEXT,
  fg_color      TEXT NOT NULL DEFAULT '#000000',
  bg_color      TEXT NOT NULL DEFAULT '#ffffff',
  style         TEXT NOT NULL DEFAULT 'square',
  size          INTEGER NOT NULL DEFAULT 400,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Link in Bio 頁面
CREATE TABLE IF NOT EXISTS bio_pages (
  id         TEXT PRIMARY KEY,
  domain_id  TEXT REFERENCES domains(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  title      TEXT,
  bio        TEXT,
  logo_url   TEXT,
  theme      TEXT NOT NULL DEFAULT '{"bgColor":"#ffffff","textColor":"#000000","buttonColor":"#000000","buttonTextColor":"#ffffff","buttonStyle":"rounded","bgGradient":""}', -- JSON 物件
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (domain_id, slug)
);

-- Bio 頁面連結
CREATE TABLE IF NOT EXISTS bio_links (
  id          TEXT PRIMARY KEY,
  bio_page_id TEXT REFERENCES bio_pages(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 點擊紀錄
CREATE TABLE IF NOT EXISTS click_logs (
  id            TEXT PRIMARY KEY,
  short_link_id TEXT REFERENCES short_links(id) ON DELETE SET NULL,
  target_id     TEXT REFERENCES link_targets(id) ON DELETE SET NULL,
  param         TEXT,
  ip            TEXT,
  user_agent    TEXT,
  referer       TEXT,
  country       TEXT,
  device        TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  in_app        TEXT,   -- facebook / messenger / instagram / threads / line / tiktok / null
  os            TEXT,   -- ios / android / other
  stage         TEXT,   -- landing / escaped / stayed / bot
  clicked_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_short_links_domain_slug ON short_links(domain_id, slug);
CREATE INDEX IF NOT EXISTS idx_short_links_is_active   ON short_links(is_active);
CREATE INDEX IF NOT EXISTS idx_link_targets_short_link ON link_targets(short_link_id);
CREATE INDEX IF NOT EXISTS idx_param_utm_rules_link    ON param_utm_rules(short_link_id);
CREATE INDEX IF NOT EXISTS idx_bio_pages_domain_slug   ON bio_pages(domain_id, slug);
CREATE INDEX IF NOT EXISTS idx_bio_links_page          ON bio_links(bio_page_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_short_link   ON click_logs(short_link_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_clicked_at   ON click_logs(clicked_at);
CREATE INDEX IF NOT EXISTS idx_click_logs_utm_source   ON click_logs(utm_source);
CREATE INDEX IF NOT EXISTS idx_click_logs_stage        ON click_logs(stage);
