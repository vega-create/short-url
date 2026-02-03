-- QR Code 背景圖片欄位
ALTER TABLE qr_settings ADD COLUMN IF NOT EXISTS bg_image_url text;
