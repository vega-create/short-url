-- =============================================
-- 補上 short_links 缺少的 UTM 欄位
-- 004 只加了 append_utm，但 API 會直接把 utm_* 寫進 short_links
-- =============================================

ALTER TABLE short_links ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS utm_content text;
