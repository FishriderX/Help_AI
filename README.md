# AutoHelp 4.0

全自動遊戲說明書生成 Web App（現有 Figma 插件 v4.4 的全雲端升級）。從 Google Sheet 讀說明書內容 → Claude 分析成版面計畫 → Figma Bridge 外掛自動渲染到畫布。**已可端對端運作。**

> 這個 repo 同時作為開發進度的存檔點，方便接續開發。

## 結構

| 資料夾 | 說明 | 啟動 |
|--------|------|------|
| `backend/` | Node 後端（port 3001）：Claude 分析、few-shot 學習模型、資產管線 | `node --env-file=.env server.js` |
| `figma-bridge/` | Figma 外掛：輪詢後端、把版面計畫渲染到畫布 | Figma → Import from manifest → 執行 → Start Polling |
| `frontend/` | Vite/React 網頁（port 5173）：貼 Sheet URL → Generate | `npm run dev` |
| `docs/` | 設計規格 specs／實作計畫 plans |

`backend/.env` 含真實 `ANTHROPIC_API_KEY`，**已被 .gitignore 排除、不在此 repo**。複製 `.env.example` 自行填入。

## 核心：學習模型（few-shot）

`backend/src/knowledge/examples.js` 存 `{label, input, output}` 範例，注入 Claude 的 system prompt。**用戶確認某頁正確 → 加成範例 → 越用越準。** 頁型辨識規則在 `backend/src/knowledge/baseKnowledge.js`，schema 在 `backend/src/services/claudeAnalyzer.js`，渲染器在 `figma-bridge/code.js`（三處要同步）。

## 已訓練的頁型（持續擴充）

- `feature_text`(GAME RULES)、`symbols_per_play`、`paytable`、`feature_card`(SCATTER/WILD)
- `jackpot`（rules + denomination 表，表格列依 Sheet 實際等級）
- `game_settings`（reels×height 格子盤面、數字變色、IP 版權釘底部）
- `setting_info`（min/max 留空為動態值、denomination 保留框給前端放圖）
- `spin_button`（標題尾端 `[tag]` → icon，沒圖時保留佔位框）

## 本機自動啟動

根目錄 `start-autohelp.ps1`（開機登入自動跑後端+前端）。詳見 `如何啟動與換伺服器.md`。
