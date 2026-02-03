-- 新增標籤欄位到 short_links
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
