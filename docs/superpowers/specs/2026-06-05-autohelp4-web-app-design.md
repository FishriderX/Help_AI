# AutoHelp 4.0 — Web App 系統設計規格

**日期**: 2026-06-05  
**狀態**: 設計完成，待實作  
**專案路徑**: `C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0`  
**參考圖片**: 4 組共 83 張（0515、Help_0417_eng、Help_0417_sch、Help_0605）

---

## 1. 專案目標

打造一個完全雲端化的全自動遊戲說明書生成助理，核心特性：

- **任何輸入格式**：Google Sheets URL、Excel、CSV、純文字、JSON
- **AI 驅動辨識**：Claude API 分析文件內容，自動判斷每頁版面類型
- **一鍵生成**：使用者（或 AI 助理）提交任務後，Figma Frame 自動生成
- **雙重介面**：Web App 對話介面 + Open REST API（可供 Claude Code 等 AI 直接呼叫）
- **Asset 管線**：上傳 symbol 圖片 → 自動去背 → 嵌入 Figma

---

## 2. 系統架構總覽

```
使用者 / AI 助理（Claude Code 等）
          │
          ▼
┌─────────────────────────────┐
│  Web App（React）            │  對話介面 + 文件輸入 + Asset 庫
│  + Open REST API             │  任何 AI 皆可透過 API 呼叫
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Backend Service（Node.js）  │  文件解析、任務排隊、知識庫管理
└──────┬──────────────┬────────┘
       │              │
       ▼              ▼
┌──────────┐   ┌──────────────────┐
│ Claude   │   │  Knowledge Base  │  內建知識（83張參考圖片分析）
│ API      │   │  + User Assets   │  + 使用者自訂上傳
└──────┬───┘   └──────────────────┘
       │  輸出 JSON Layout Plan
       ▼
┌─────────────────────────────┐
│  Figma Bridge Plugin         │  一次性安裝，背景輪詢，執行繪圖
│  （最輕量 Figma 插件）        │
└─────────────────────────────┘
              │
              ▼
         Figma File ✅
```

---

## 3. 核心資料模型：JSON Layout Plan

Claude API 的輸出格式，也是 Bridge Plugin 的輸入格式。

```json
{
  "meta": {
    "job_id": "abc123",
    "language": "en",
    "figma_file_key": "xyz",
    "figma_page": "HELP",
    "theme": "dark"
  },
  "assets": {
    "C1": {
      "original_url": "storage/assets/original/c1.png",
      "transparent_url": "storage/assets/transparent/c1.png",
      "bg_removed": true,
      "type": "symbol"
    }
  },
  "pages": [
    {
      "id": "PAGE_1",
      "type": "paytable",
      "title": "PAYTABLE",
      "rules": ["ALL WINS SHOWN FOR BET MULTIPLIER 1X."],
      "symbols": [
        { "asset": "M1", "payouts": [{"range": "8-9", "value": 400}] }
      ]
    },
    {
      "id": "PAGE_2",
      "type": "feature_text",
      "title": "CASCADING REELS FEATURE",
      "body": ["ALL SYMBOLS IN WINNING CLUSTERS WILL BE REMOVED.", "..."]
    }
  ]
}
```

### 支援的 Page Type 清單

| type | 說明 | 來源圖片觀察 |
|---|---|---|
| `paytable` | 符號賠率卡片網格 | 所有遊戲都有 |
| `symbols_per_play` | BET/SYMBOLS 表格含 ✕ | Help_0417 |
| `prizes_table` | 雙欄 BET~RANGE 表格 | Help_0417 |
| `feature_text` | 標題 + bullet 規則清單 | 所有遊戲 |
| `jackpot` | 規則 + DENOMINATION 表格 | 所有遊戲 |
| `setting_info` | WAYS/TOTAL BET 表 + 說明框 | 所有遊戲 |
| `special_feature` | 主標題 + 子功能分段 + 圖示 | Help_0417 |
| `multi_section` | 主規則 + 副標題群 + 可選表格 | Help_0605 |
| `game_settings` | 棋盤 + 版權聲明 | Help_0605 |
| `spin_button` | 圖示 + 單行說明 | Help_0605 |
| `fortune_chance` | 功能說明 + 按鈕圖示 | Help_0605 |
| `instant_bonus` | 功能說明 | Help_0605 |
| `custom` | AI 無法確定類型時 | fallback |

---

## 4. Backend Service

### 目錄結構
```
backend/
├── api/
│   ├── routes/
│   │   ├── generate.js       # POST /api/v1/generate
│   │   ├── jobs.js           # GET  /api/v1/jobs/:id
│   │   ├── assets.js         # POST /api/v1/assets/upload
│   │   └── knowledge.js      # GET/POST /api/v1/knowledge
│   └── middleware/auth.js    # API Key 驗證
├── services/
│   ├── document-parser.js    # 任何格式 → 標準化文字
│   ├── claude-analyzer.js    # 呼叫 Claude API
│   ├── job-manager.js        # 任務狀態管理
│   ├── asset-store.js        # 圖片儲存
│   └── bg-remover.js         # 背景移除（Remove.bg API）
├── knowledge/
│   ├── base-knowledge.json   # 83 張參考圖片分析結果（內建）
│   └── user-knowledge/       # 使用者自訂
└── storage/
    └── assets/
        ├── original/
        └── transparent/      # 去背後版本
```

### Job 生命週期
```
queued → analyzing → ai_processing → pending_figma → rendering → complete
                                                               └→ failed
```

---

## 5. AI Layer（Claude API 整合）

### System Prompt 結構
1. **角色定義**：遊戲說明書版面分析師
2. **知識庫注入**：`base-knowledge.json` 內容（從 83 張圖片提取的版面規則）
3. **輸出格式約束**：嚴格的 JSON Schema
4. **辨識特徵**：每種 page type 的關鍵辨識詞

### 知識庫建立方式
- 一次性用 Claude Vision 分析 83 張參考圖片
- 提取：版面結構、元素位置、辨識特徵
- 輸出：`base-knowledge.json`（每種類型的 layout_rules）
- 使用者上傳新參考圖 → 自動分析 → 追加到 user-knowledge

---

## 6. Asset 管線

```
上傳原始圖片
    │
    ▼ Remove.bg API 自動去背
    ├── original/ 保存原圖
    └── transparent/ 保存透明 PNG   ← Figma 使用
    │
    ▼ Claude Vision 分析（type=reference 時）
    → 提取版面知識 → 更新 Knowledge Base
```

**背景美術自動生成**（Phase 2，暫不實作）：
- 使用者描述風格 → 呼叫圖片生成 API → 生成遊戲主題背景

---

## 7. Figma Bridge Plugin

### 連線機制
- 每 3 秒 polling GET `/api/v1/bridge/pending`
- 有任務時下載 Layout Plan JSON
- 執行 Figma Plugin API 繪圖
- 完成後 POST `/api/v1/bridge/complete`

### 渲染引擎架構
```javascript
async function executeLayoutPlan(plan) {
  await preloadFonts(plan.theme);
  const imageCache = await downloadAssets(plan.assets);  // 下載透明 PNG
  const outerFrame = createOuterFrame(plan.meta);
  for (const page of plan.pages) {
    const renderer = getRenderer(page.type);
    const pageFrame = await renderer.render(page, plan.theme, imageCache);
    outerFrame.appendChild(pageFrame);
  }
}
```

### Theme 系統
內建 `dark`（深色遊戲風格）和 `light`（淺色商業風格）兩種預設。  
使用者可自訂 custom theme（顏色、字型、間距）。

---

## 8. Web App 前端

### 主工作區三欄佈局
- **左欄**：AI 對話介面（描述需求、確認內容、追問）
- **中欄**：文件輸入（URL / 上傳 / 貼上）+ 設定（語言、主題、Figma 目標）+ 一鍵生成按鈕
- **右欄**：Asset 庫（查看去背狀態）+ 知識庫狀態

---

## 9. Open REST API 規格

### 生成任務
```
POST /api/v1/generate
Headers: X-API-Key: {key}
Body: {
  "document": { "type": "sheets_url", "value": "https://..." },
  "figma_file_key": "abc123",
  "figma_page": "HELP",
  "language": "en",
  "theme": "dark"
}
Response: { "job_id": "xyz789", "status": "queued" }
```

### 查詢任務狀態
```
GET /api/v1/jobs/{job_id}
Response: {
  "status": "complete",
  "progress": 100,
  "figma_url": "https://figma.com/file/...",
  "layout_plan": { ... }
}
```

### 上傳 Asset
```
POST /api/v1/assets/upload
Body: multipart/form-data (file, name, type)
Response: {
  "asset_id": "a1b2c3",
  "transparent_url": "...",
  "status": "processing | ready"
}
```

---

## 10. Tech Stack

| 層級 | 技術選擇 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL（Supabase） |
| File Storage | Supabase Storage |
| AI | Claude API（claude-sonnet-4-5 或以上） |
| 背景移除 | Remove.bg API |
| Hosting（Frontend） | Vercel |
| Hosting（Backend） | Railway 或 Render |
| Figma Bridge | Figma Plugin（JavaScript） |

---

## 11. 開發 Roadmap

### Phase 1（核心功能）
1. Backend + Claude API 整合 + JSON Layout Plan
2. Figma Bridge Plugin（渲染引擎）
3. 知識庫建立（分析 83 張參考圖片）
4. Web App 基本介面

### Phase 2（完整功能）
5. Asset 上傳 + 自動去背
6. Open API 完整實作
7. Theme 系統

### Phase 3（進階）
8. 背景美術 AI 自動生成
9. 多人協作 / 專案管理
10. 更多遊戲類型支援

---

## 12. 參考資料

- 參考圖片位置：`C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\`
- 現有插件（v4.4）：`C:\Users\leolu\Downloads\AutoHelp3.0\`
- GitHub：https://github.com/FishriderX/123.git
- 現有插件核心邏輯可作為 Bridge Plugin 渲染引擎的起點
