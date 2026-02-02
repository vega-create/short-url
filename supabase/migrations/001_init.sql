-- =============================================
-- 智慧媽咪短網址系統 - 資料庫初始化
-- =============================================

-- =====================
-- 網域管理
-- =====================
create table domains (
  id uuid primary key default gen_random_uuid(),
  domain text unique not null,
  name text,                         -- 備註名稱
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 短網址
-- =====================
create table short_links (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references domains(id) on delete cascade,
  slug text not null,
  name text,                         -- 備註名稱
  target_url text not null,          -- 主要目標網址（單一目標時使用）
  is_active boolean default true,
  use_ab_test boolean default false, -- 是否啟用 A/B 分流
  
  -- 追蹤碼（選用）
  pixel_id text,                     -- FB Pixel ID
  gtm_id text,                       -- GTM Container ID
  ga_id text,                        -- GA4 Measurement ID
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(domain_id, slug)
);

-- =====================
-- 目標網址（支援 A/B 分流）
-- =====================
create table link_targets (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid references short_links(id) on delete cascade,
  target_url text not null,
  weight int default 1,              -- 分流權重
  name text,                         -- 版本名稱 (A/B/C)
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =====================
-- 點擊紀錄（選用，如只用 GA4 可省略）
-- =====================
create table click_logs (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid references short_links(id) on delete set null,
  target_id uuid references link_targets(id) on delete set null,
  param text,                        -- 路徑參數 /FB/限動
  ip inet,
  user_agent text,
  referer text,
  country text,
  device text,                       -- mobile/desktop/tablet
  clicked_at timestamptz default now()
);

-- =====================
-- Link in Bio 頁面
-- =====================
create table bio_pages (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references domains(id) on delete cascade,
  slug text not null,
  title text,
  bio text,
  logo_url text,
  theme jsonb default '{
    "bgColor": "#ffffff",
    "textColor": "#000000",
    "buttonColor": "#000000",
    "buttonTextColor": "#ffffff",
    "buttonStyle": "rounded",
    "bgGradient": ""
  }'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(domain_id, slug)
);

-- =====================
-- Bio 頁面連結
-- =====================
create table bio_links (
  id uuid primary key default gen_random_uuid(),
  bio_page_id uuid references bio_pages(id) on delete cascade,
  title text not null,
  url text not null,
  icon text,                         -- emoji 或 icon class
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =====================
-- QR Code 設定
-- =====================
create table qr_settings (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid references short_links(id) on delete cascade unique,
  logo_url text,                     -- Logo 圖片 URL
  fg_color text default '#000000',   -- 前景色
  bg_color text default '#ffffff',   -- 背景色
  style text default 'square',       -- square / dots / rounded
  size int default 400,              -- 輸出尺寸
  created_at timestamptz default now()
);

-- =====================
-- 索引優化
-- =====================
create index idx_short_links_domain_slug on short_links(domain_id, slug);
create index idx_short_links_is_active on short_links(is_active);
create index idx_link_targets_short_link on link_targets(short_link_id);
create index idx_click_logs_short_link on click_logs(short_link_id);
create index idx_click_logs_clicked_at on click_logs(clicked_at);
create index idx_bio_pages_domain_slug on bio_pages(domain_id, slug);
create index idx_bio_links_page on bio_links(bio_page_id);

-- =====================
-- RLS（Row Level Security）- 基本設定
-- =====================
alter table domains enable row level security;
alter table short_links enable row level security;
alter table link_targets enable row level security;
alter table click_logs enable row level security;
alter table bio_pages enable row level security;
alter table bio_links enable row level security;
alter table qr_settings enable row level security;

-- 允許 service_role 完整存取（後台 API 使用）
create policy "Service role full access" on domains for all using (true) with check (true);
create policy "Service role full access" on short_links for all using (true) with check (true);
create policy "Service role full access" on link_targets for all using (true) with check (true);
create policy "Service role full access" on click_logs for all using (true) with check (true);
create policy "Service role full access" on bio_pages for all using (true) with check (true);
create policy "Service role full access" on bio_links for all using (true) with check (true);
create policy "Service role full access" on qr_settings for all using (true) with check (true);

-- 公開讀取（重定向用）
create policy "Public read short_links" on short_links for select using (true);
create policy "Public read domains" on domains for select using (true);
create policy "Public read link_targets" on link_targets for select using (true);
create policy "Public read bio_pages" on bio_pages for select using (true);
create policy "Public read bio_links" on bio_links for select using (true);
