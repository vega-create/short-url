-- =============================================
-- 強制跳外部瀏覽器（FB / IG / Threads / LINE 內建瀏覽器 → Safari / Chrome）
-- =============================================

-- 1. short_links：開關 + 觸發平台
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS force_external boolean DEFAULT false;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS external_platforms text[] DEFAULT '{facebook,instagram,threads,line}';

-- 2. click_logs：在哪個 App、什麼 OS、走到哪一步
--    in_app: facebook / messenger / instagram / threads / line / tiktok / null(一般瀏覽器)
--    os:     ios / android / other
--    stage:  landing(第一次點擊) / escaped(已在外部瀏覽器開啟) / stayed(留在 App 內) / bot(爬蟲)
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS in_app text;
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS os text;
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS stage text;

CREATE INDEX IF NOT EXISTS idx_click_logs_stage ON click_logs(stage);
