# 🔗 智慧媽咪短網址系統

自建短網址管理系統，取代 Lihi 付費服務。

## 功能

- ✅ 多網域 / 子網域支援
- ✅ 短網址建立，目標隨時更換
- ✅ 路徑參數自由擴展（/slug/FB/IG/任意文字）
- ✅ A/B 分流測試（按權重分配流量）
- ✅ QR Code 產生器（可嵌入品牌 Logo）
- ✅ Link in Bio 頁面（完全客製化）
- ✅ 後台統一管理介面

## 技術架構

- **前端/後端**：Next.js 16 (App Router)，以 [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) 跑在 Cloudflare Workers
- **資料庫**：Cloudflare D1（SQLite）。schema 在 `migrations/d1/`，程式透過 `src/lib/db.ts` 的 supabase-js 相容層存取
- **檔案**：Cloudflare R2（QR Logo／背景圖、Bio Logo），由 `/api/files/<key>` 讀出
- **QR Code**：純 JS 產生（`src/lib/qr/`，uqr + upng-js + jpeg-js），Workers 不需要 sharp
- **樣式**：Tailwind CSS

> 2026-11 前為 Supabase（Postgres）+ Vercel；搬遷腳本見 `scripts/migrate-from-supabase.mjs`，舊 schema 保留在 `supabase/migrations/` 供對照。

## 快速開始

### 1. 安裝與本機資料庫

```bash
npm install
npm run d1:migrate          # 建本機 D1（.wrangler/state/v3）
cp .dev.vars.example .dev.vars   # 填入 ADMIN_PASSWORD
npm run dev                 # next dev，會自動拿到本機 D1 / R2 綁定
```

### 2. 前往後台

瀏覽 `http://localhost:3000/vega888admin`，輸入管理員密碼登入。
短網址的「網域」要先在後台新增 `localhost:3000` 才能在本機測轉址。

### 3. 用 Workers 執行環境預覽

```bash
npm run preview             # opennextjs-cloudflare build + wrangler dev
```

## 部署到 Cloudflare

1. `npx wrangler login`（需要 d1 / r2 / workers 權限）
2. 建資源（只需一次）：`npx wrangler d1 create short-url`、`npx wrangler r2 bucket create short-url-uploads`，把 database_id 填進 `wrangler.jsonc`
3. 套 schema：`npm run d1:migrate:remote`
4. 設密碼：`npx wrangler secret put ADMIN_PASSWORD`
5. 部署：`npm run deploy`
6. 網域：`wrangler.jsonc` 的 `routes` 每個短網址網域一行（`custom_domain: true`），zone 必須在同一個 Cloudflare 帳號；
   或到 Dashboard → Workers → short-url → Domains & Routes 新增。DNS 由 Cloudflare 自動建立，不需要再設 CNAME。

每週日會由 GitHub Actions（`.github/workflows/backup.yml`）用 `wrangler d1 export` 備份整個 D1 成 Artifact，
需要在 repo secrets 設 `CLOUDFLARE_API_TOKEN`（Account → D1:Edit）。

## 使用方式

### 短網址

```
https://go.smartmommy.com/母親節
https://go.smartmommy.com/母親節/FB
https://go.smartmommy.com/母親節/IG/限動

→ 全部導向你設定的目標網址
```

### Bio 頁面

```
https://go.smartmommy.com/@links
```

### QR Code

在後台的短網址管理中，點擊「QR」按鈕即可設定與下載。

## 專案結構

```
src/
├── app/
│   ├── [...slug]/route.ts       # 短網址重定向 + Bio 頁面渲染
│   ├── admin/                    # 後台管理介面
│   │   ├── layout.tsx           # 管理介面框架 + 登入
│   │   ├── page.tsx             # 總覽
│   │   ├── domains/page.tsx     # 網域管理
│   │   ├── links/page.tsx       # 短網址管理 + QR Code
│   │   └── bio/page.tsx         # Bio 頁面管理
│   ├── api/                      # API 路由
│   │   ├── auth/                # 認證
│   │   ├── domains/             # 網域 CRUD
│   │   ├── links/               # 短網址 CRUD + 目標管理
│   │   ├── bio/                 # Bio 頁面 CRUD + 連結管理
│   │   └── qr/                  # QR Code 產生
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── db.ts                    # D1 / R2 相容層（supabase-js 寫法）
│   ├── db-types.ts              # 欄位轉換與關聯對照
│   ├── qr/                      # 純 JS QR 產生
│   ├── types.ts                 # TypeScript 型別
│   ├── utils.ts                 # 工具函式
│   └── auth.ts                  # 認證邏輯
└── migrations/d1/0001_init.sql  # D1 Schema
scripts/migrate-from-supabase.mjs # Supabase → D1 一次性搬運
```
