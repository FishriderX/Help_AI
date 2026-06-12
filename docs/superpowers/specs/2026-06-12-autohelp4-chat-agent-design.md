# AutoHelp 4.0 — 對話式修頁 Agent（v1 MVP）設計規格

日期：2026-06-12
狀態：設計已確認，待寫實作計畫

## 1. 目標

把 AutoHelp 從「固定流程的自動化工具」往「agent」推進的第一步：讓使用者用**對話**指揮 Claude 去**修改已生成說明書的頁面內容**，並能**順手把修對的頁面存成學習範例**（教模型）。Claude 在一個**工具迴圈**裡自己決定要讀哪頁、怎麼改，但任何會「動到畫布或存範例」的動作**一律先提案、由使用者確認後才執行**。

成功標準：
- 使用者能在網頁聊天框輸入如「第 7 頁 MINI 賠率改成 1000」，Claude 讀到該頁、提出精確修改提案；使用者按確認後，後端套用並觸發 Figma 重畫。
- 使用者能說「這頁對了，記起來」，Claude 提議把該頁存成學習範例；確認後寫入並於下次生成立即生效。
- 任何修改在使用者確認前都不會發生。

## 2. 範圍

**v1 納入**
- 修改既有頁面的**內容/數值/文字**（改某頁的 JSON 欄位）。
- **教模型**：把某頁存成 few-shot 學習範例。
- 對話式介面（網頁 Assistant 面板加聊天框 + 確認卡片）。
- 提案→確認→套用→重畫 的安全流程。
- 還原上一步（undo）已套用的頁面修改。

**v1 不納入（未來）**
- 改頁型、增頁/刪頁、重新分類（結構性編輯）。
- 重新從 Sheet 分析整本、生成背景美術。
- 多本說明書並行對話（v1 只對「當前 job」一本）。

## 3. 架構與資料流

新增/改動：
- **後端**：新路由 `POST /api/v1/chat`、`POST /api/v1/chat/confirm`；新模組 `src/services/agent.js`（迴圈 + 工具定義 + 工具執行）。
- **前端**：Assistant 面板加聊天輸入框、對話訊息列、確認卡片。
- **Figma 外掛**：**不改**。plan 變回 `pending_figma` 後，現有輪詢機制自動重畫。

一次修頁的資料流：
```
使用者訊息 → POST /api/v1/chat
  → agent 迴圈：呼叫唯讀工具(列出頁/讀某頁/讀原始資料)自動取得資訊
  → Claude 呼叫「提議改某頁」→ 後端不執行，存成 pendingProposal、回傳提案
前端顯示確認卡片 → 使用者按確認 → POST /api/v1/chat/confirm
  → 後端套用：換掉 plan 中該頁 → job 標回 PENDING_FIGMA
  → 輪詢中的 Figma 外掛重畫 → /bridge/complete 回報完成
```

核心原則：**會改變狀態的動作不在 AI 迴圈內自動執行**。AI 只負責「理解＋讀取＋產出精確提案」；確認後由後端**確定性地**套用，不再呼叫 AI。

## 4. 元件

### 4.1 對話狀態
跟 `jobManager` 同風格，記憶體儲存，鍵為 jobId：
```
conversation = {
  jobId,
  messages: [],          // Anthropic messages 格式(user/assistant，含 tool_use/tool_result)
  pendingProposal: null, // 待確認的提案或 null
  history: [],           // 已套用變更的快照(供還原)
}
```

### 4.2 Agent 迴圈（`src/services/agent.js`）
- 用現有 `@anthropic-ai/sdk`，`client.messages.create` 帶 `tools`。
- 迴圈：送出 messages → 收到回應；若含 `tool_use`：
  - 唯讀工具 → 後端執行、把 `tool_result` 接回 messages、繼續迴圈。
  - 提議工具 → 不執行，存成 `pendingProposal`，跳出迴圈、回傳提案 + Claude 的說明文字。
- 純文字回應（沒有工具呼叫）→ 直接回傳給使用者。
- 模型：`claude-sonnet-4-6`（與現有 analyzer 一致）。

### 4.3 學習範例儲存
- 新檔 `backend/src/knowledge/learnedExamples.json`（陣列 `{label, input, output}`，初始 `[]`）。
- `buildExamplesPrompt()` 改為**每次呼叫時**讀取 `EXAMPLES`(手工黃金範例) + `learnedExamples.json`(agent 長出來的)，合併注入。即時生效、免重啟。
- 為純資料檔、納入 git，隨 commit+push 一起追蹤。

## 5. 工具規格

### 唯讀（迴圈中自動執行，無需確認）
- `list_pages()` → `[{ id, type, title }]`（當前 job 的 plan 各頁摘要）。
- `get_page(pageId)` → 該頁完整 JSON。
- `get_source(pageId)` → 該頁在 Sheet 的原始解析文字（依 plan 頁與來源 "PAGE N" 對應抓取；找不到則回空字串）。

### 提議（停止迴圈、產生確認卡，確認後才執行）
- `propose_page_edit(pageId, newPage, summary)`：提議把 `pageId` 換成 `newPage`(完整頁 JSON)。`summary` 為白話摘要。
- `propose_example(label, input, output, summary)`：提議把一筆 `{label, input, output}` 存進 `learnedExamples.json`。

工具的 JSON schema 於實作計畫中定義；提議工具的參數即為「待確認內容」。

## 6. 端點與確認流程

### `POST /api/v1/chat`
請求：`{ jobId, message }`（jobId 省略時用最後一個 job）。
動作：附加 user 訊息 → 跑 agent 迴圈 → 回 `{ assistantText, proposal | null }`。
若已有 `pendingProposal` 未決，先要求處理它（回提示），不開新提案。

### `POST /api/v1/chat/confirm`
請求：`{ jobId, decision: 'confirm' | 'cancel' }`。
- `confirm` + page_edit：
  1. 驗證 `newPage`（見 §7）。
  2. 把舊頁快照推入 `history`。
  3. 取代 plan 中該頁，`updateJob(jobId, PENDING_FIGMA, { layoutPlan })` 觸發重畫。
- `confirm` + example：把該筆 append 到 `learnedExamples.json`。
- `cancel`：丟棄提案。
- 任一情況清空 `pendingProposal`，回 `{ ok, message }`。v1 確認後不再呼叫 AI。

### `POST /api/v1/chat/undo`
還原 `history` 最後一筆頁面快照、重新標 `PENDING_FIGMA` 重畫。

## 7. 錯誤處理與安全

- **迴圈上限**：每則訊息最多 8 次工具呼叫，超過即停並回報。
- **可中斷**：`/chat` 使用 `AbortController`；前端 Stop 取消當前 Claude 呼叫（沿用現有機制）。
- **必經確認**：mutation 只能透過 `/chat/confirm` 發生，prompt 之外另有架構保證。
- **沒有 job/plan**：回「請先生成一本說明書」，不報錯。
- **套用前驗證**：`newPage` 必須有 `id`、`type`，且 `type` 為已知頁型；不合法則拒絕、回報，不改 plan。
- **可還原**：套用前存快照，支援 `undo`。
- **工具錯誤**：例如 pageId 不存在 → 以 `tool_result` 回傳錯誤訊息給 Claude，讓它修正或詢問，不使流程崩潰。

## 8. 測試策略

**單元測試（jest，`backend/tests/`）**
- 工具執行：`list_pages`/`get_page`/`get_source` 回傳正確；提議工具產出正確的待確認結構。
- Agent 迴圈：以**假的 Claude 回應**（stub `tool_use`）驗證會自動跑唯讀工具、遇提議工具會停並回提案，且尊重 8 次上限——不打真 API。
- 確認端點：confirm page_edit 會驗證、存快照、換頁、標 `PENDING_FIGMA`；confirm example 會 append 到 `learnedExamples.json`；cancel 會清提案；undo 會還原。
- 驗證：壞的 `newPage` 被擋。

**整合驗證**
- 以「直接呼叫」技巧跑真 Claude（不污染畫布）驗證提案 JSON 正確。
- 端對端（聊天→提案→確認→Figma 重畫）由使用者於 app 內確認。

## 9. 非目標 / 未來

- 結構性編輯、整本重生成、背景美術生成、多本對話、確認後讓 AI 收尾發言——皆留待後續版本。
- v1 完成即代表系統在技術上具備 agent（工具迴圈 + 自主決策 + 人類確認）。
