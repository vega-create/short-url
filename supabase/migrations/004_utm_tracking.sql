-- =============================================
-- UTM 追蹤功能 Migration
-- =============================================

-- 1. short_links 新增 append_utm 欄位
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS append_utm boolean DEFAULT false;

-- 2. 渠道 UTM 對照表
CREATE TABLE IF NOT EXISTS param_utm_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id uuid REFERENCES short_links(id) ON DELETE CASCADE,
  param_pattern text NOT NULL,       -- 'FB', 'IG/限動', 'KOL/小紅'
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(short_link_id, param_pattern)
);

-- 3. click_logs 確保有 UTM 欄位
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_campaign text;

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_param_utm_rules_link ON param_utm_rules(short_link_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_utm_source ON click_logs(utm_source);
