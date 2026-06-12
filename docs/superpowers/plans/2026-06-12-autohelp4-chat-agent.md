# 對話式修頁 Agent (v1 MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者用對話指揮 Claude 修改已生成說明書的頁面內容、並把修對的頁面存成學習範例；所有變更先提案、使用者確認後才套用並重畫。

**Architecture:** 後端新增 `/api/v1/chat` 系列端點與 `agent.js` 工具迴圈。Claude 用唯讀工具(列出頁/讀頁/讀原文)自動取得資訊，要動到狀態時改為「提議」；後端把提議存成 pending，前端顯示確認卡，確認後由後端確定性套用（換頁→標 PENDING_FIGMA→現有輪詢外掛自動重畫；或追加學習範例）。

**Tech Stack:** Node + Express (ESM)、`@anthropic-ai/sdk` 工具呼叫、jest + supertest、React + Vite(前端)。

**Conventions:** 後端 ESM、路由掛在 `src/index.js`、驗證用 `x-api-key`。每個 commit 用 `git -C <root>`；本計畫的 `<root>` = 專案根目錄單一 repo。

---

## 檔案結構

**後端**
- Create `backend/src/knowledge/learnedExamples.json` — 學習範例資料檔(初始 `[]`)。
- Create `backend/src/knowledge/learnedExamples.js` — 載入/追加學習範例。
- Modify `backend/src/knowledge/examples.js` — `buildExamplesPrompt()` 合併學習範例。
- Create `backend/src/services/agentTools.js` — 工具 schema + 唯讀工具執行器。
- Create `backend/src/services/conversationStore.js` — 每 job 一個對話狀態(記憶體)。
- Create `backend/src/services/applyChange.js` — 驗證、套用提議、還原。
- Create `backend/src/services/agent.js` — agent 迴圈(可注入 createMessage 以利測試)。
- Create `backend/src/routes/chat.js` — `/chat`、`/confirm`、`/undo`。
- Modify `backend/src/services/jobManager.js` — 加 `getLatestJob()`。
- Modify `backend/src/routes/generate.js` — 把解析後的原文存到 job 供 `get_source` 用。
- Modify `backend/src/index.js` — 掛載 chatRoute。

**前端**
- Modify `frontend/src/types.ts` — Chat 相關型別。
- Modify `frontend/src/api/client.ts` — chat/confirm/undo API。
- Create `frontend/src/components/ChatPanel.tsx` — 聊天框 + 訊息 + 確認卡。
- Modify `frontend/src/App.tsx` — 掛入 ChatPanel。

---

## Task 1: 學習範例資料檔 + 合併注入

**Files:**
- Create: `backend/src/knowledge/learnedExamples.json`
- Create: `backend/src/knowledge/learnedExamples.js`
- Modify: `backend/src/knowledge/examples.js`
- Test: `backend/tests/learnedExamples.test.js`

- [ ] **Step 1: 建資料檔**

`backend/src/knowledge/learnedExamples.json`:
```json
[]
```

- [ ] **Step 2: 寫失敗測試**

`backend/tests/learnedExamples.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadLearnedExamples, addLearnedExample, LEARNED_PATH } from '../src/knowledge/learnedExamples.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('learnedExamples', () => {
  let backup;
  beforeEach(() => { backup = fs.readFileSync(LEARNED_PATH, 'utf8'); fs.writeFileSync(LEARNED_PATH, '[]'); });
  afterEach(() => { fs.writeFileSync(LEARNED_PATH, backup); });

  it('loads empty array initially', () => {
    expect(loadLearnedExamples()).toEqual([]);
  });

  it('appends and persists an example', () => {
    addLearnedExample({ label: 'x', input: 'in', output: { id: 'PAGE_1', type: 'feature_text' } });
    const loaded = loadLearnedExamples();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].label).toBe('x');
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `cd backend && npx jest tests/learnedExamples.test.js`
Expected: FAIL（找不到模組 `learnedExamples.js`）

- [ ] **Step 4: 實作模組**

`backend/src/knowledge/learnedExamples.js`:
```js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LEARNED_PATH = path.join(__dirname, 'learnedExamples.json');

export function loadLearnedExamples() {
  try {
    const raw = fs.readFileSync(LEARNED_PATH, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addLearnedExample(example) {
  const all = loadLearnedExamples();
  all.push(example);
  fs.writeFileSync(LEARNED_PATH, JSON.stringify(all, null, 2));
  return example;
}
```

- [ ] **Step 5: 合併進 prompt**

Modify `backend/src/knowledge/examples.js` — 頂部加 import，改 `buildExamplesPrompt`：
```js
import { loadLearnedExamples } from './learnedExamples.js';
```
把 `buildExamplesPrompt` 開頭的 `if (!EXAMPLES.length) return '';` 與迴圈改為：
```js
export function buildExamplesPrompt() {
  const all = EXAMPLES.concat(loadLearnedExamples());
  if (!all.length) return '';
  let p = '\nLEARNED EXAMPLES — reproduce this exact input→output mapping for similar pages:\n\n';
  for (const ex of all) {
    p += `--- ${ex.label} ---\n`;
    p += `INPUT (parsed spreadsheet text):\n${ex.input}\n`;
    p += `CORRECT OUTPUT (one page object, no "|" characters):\n${JSON.stringify(ex.output)}\n\n`;
  }
  return p;
}
```

- [ ] **Step 6: 跑測試確認通過**

Run: `cd backend && npx jest tests/learnedExamples.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C <root> add backend/src/knowledge/learnedExamples.json backend/src/knowledge/learnedExamples.js backend/src/knowledge/examples.js backend/tests/learnedExamples.test.js
git -C <root> commit -m "feat(agent): learnedExamples 資料檔 + 合併注入 prompt"
```

---

## Task 2: jobManager.getLatestJob + generate 存原文

**Files:**
- Modify: `backend/src/services/jobManager.js`
- Modify: `backend/src/routes/generate.js`
- Test: `backend/tests/jobManager.latest.test.js`

- [ ] **Step 1: 寫失敗測試**

`backend/tests/jobManager.latest.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { createJob, getLatestJob } from '../src/services/jobManager.js';

describe('getLatestJob', () => {
  it('returns the most recently created job', () => {
    const a = createJob({ tag: 'a' });
    const b = createJob({ tag: 'b' });
    expect(getLatestJob().id).toBe(b.id);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx jest tests/jobManager.latest.test.js`
Expected: FAIL（`getLatestJob` 不存在）

- [ ] **Step 3: 實作 getLatestJob**

Modify `backend/src/services/jobManager.js` — 在檔尾加：
```js
export function getLatestJob() {
  let latest = null;
  for (const job of jobs.values()) {
    if (!latest || job.createdAt >= latest.createdAt) latest = job;
  }
  return latest;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx jest tests/jobManager.latest.test.js`
Expected: PASS

- [ ] **Step 5: generate 存解析原文**

Modify `backend/src/routes/generate.js` — 在 `processJob` 中 `const parsed = await parseDocument(document);` 之後加一行，把原文存到 job 上供 `get_source` 使用：
```js
    if (job) job._parsedContent = parsed.content;
```
（`job` 變數已在函式上方 `const job = getJob(jobId);` 取得。）

- [ ] **Step 6: Commit**

```bash
git -C <root> add backend/src/services/jobManager.js backend/src/routes/generate.js backend/tests/jobManager.latest.test.js
git -C <root> commit -m "feat(agent): getLatestJob + 於 job 保存解析原文"
```

---

## Task 3: 工具 schema + 唯讀工具執行器

**Files:**
- Create: `backend/src/services/agentTools.js`
- Test: `backend/tests/agentTools.test.js`

- [ ] **Step 1: 寫失敗測試**

`backend/tests/agentTools.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { TOOL_DEFS, runReadTool, isProposeTool } from '../src/services/agentTools.js';

const job = {
  _parsedContent: ' | PAGE 7 | TITLE | JACKPOT FEATURE\n | PAGE 8 | TITLE | INSTANT BONUS',
  result: { layoutPlan: { pages: [
    { id: 'PAGE_7', type: 'jackpot', title: 'JACKPOT FEATURE', rules: ['a'] },
    { id: 'PAGE_8', type: 'instant_bonus', title: 'INSTANT BONUS' },
  ] } },
};

describe('agentTools', () => {
  it('exposes 5 tool defs incl. propose tools', () => {
    const names = TOOL_DEFS.map((t) => t.name);
    expect(names).toEqual(['list_pages', 'get_page', 'get_source', 'propose_page_edit', 'propose_example']);
  });

  it('list_pages returns id/type/title', () => {
    const out = runReadTool('list_pages', {}, { job });
    expect(out).toEqual([
      { id: 'PAGE_7', type: 'jackpot', title: 'JACKPOT FEATURE' },
      { id: 'PAGE_8', type: 'instant_bonus', title: 'INSTANT BONUS' },
    ]);
  });

  it('get_page returns the full page', () => {
    expect(runReadTool('get_page', { pageId: 'PAGE_7' }, { job }).rules).toEqual(['a']);
  });

  it('get_source returns the matching source lines', () => {
    expect(runReadTool('get_source', { pageId: 'PAGE_7' }, { job })).toContain('JACKPOT FEATURE');
  });

  it('get_page throws on unknown page', () => {
    expect(() => runReadTool('get_page', { pageId: 'PAGE_99' }, { job })).toThrow();
  });

  it('isProposeTool detects propose tools', () => {
    expect(isProposeTool('propose_page_edit')).toBe(true);
    expect(isProposeTool('get_page')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx jest tests/agentTools.test.js`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 agentTools.js**

`backend/src/services/agentTools.js`:
```js
// 工具定義(Anthropic tool schema)與唯讀工具執行器。
export const TOOL_DEFS = [
  {
    name: 'list_pages',
    description: '列出當前說明書每一頁的 id、頁型(type)、標題(title)。先用它把使用者說的「第幾頁/某某頁」對應到真正的 page id。',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_page',
    description: '讀取某一頁完整的版面 JSON。',
    input_schema: { type: 'object', properties: { pageId: { type: 'string' } }, required: ['pageId'] },
  },
  {
    name: 'get_source',
    description: '讀取某一頁在來源 Google Sheet 的原始文字（修改依據，也是存成學習範例時的 input）。',
    input_schema: { type: 'object', properties: { pageId: { type: 'string' } }, required: ['pageId'] },
  },
  {
    name: 'propose_page_edit',
    description: '提議把某一頁換成新的版面 JSON。不會立即生效——會先請使用者確認。newPage 必須是完整的一頁物件（含 id、type）。',
    input_schema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        newPage: { type: 'object' },
        summary: { type: 'string', description: '用白話一句話說明這次改了什麼' },
      },
      required: ['pageId', 'newPage', 'summary'],
    },
  },
  {
    name: 'propose_example',
    description: '提議把一頁存成 few-shot 學習範例（教模型）。不會立即生效——會先請使用者確認。',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        input: { type: 'string', description: '該頁在 Sheet 的原始文字' },
        output: { type: 'object', description: '該頁正確的版面 JSON' },
        summary: { type: 'string' },
      },
      required: ['label', 'input', 'output', 'summary'],
    },
  },
];

const PROPOSE = new Set(['propose_page_edit', 'propose_example']);
export function isProposeTool(name) {
  return PROPOSE.has(name);
}

function pages(job) {
  return (job && job.result && job.result.layoutPlan && job.result.layoutPlan.pages) || [];
}

// pageId 形如 "PAGE_7" → 來源用 "PAGE 7"；回傳含該標籤的原文行。
function sourceForPage(job, pageId) {
  const label = String(pageId).replace('_', ' ');
  const content = job && job._parsedContent ? job._parsedContent : '';
  const lines = content.split('\n').filter((l) => l.includes(label));
  return lines.join('\n');
}

export function runReadTool(name, input, ctx) {
  const job = ctx.job;
  if (name === 'list_pages') {
    return pages(job).map((p) => ({ id: p.id, type: p.type, title: p.title }));
  }
  if (name === 'get_page') {
    const page = pages(job).find((p) => p.id === input.pageId);
    if (!page) throw new Error(`page not found: ${input.pageId}`);
    return page;
  }
  if (name === 'get_source') {
    const page = pages(job).find((p) => p.id === input.pageId);
    if (!page) throw new Error(`page not found: ${input.pageId}`);
    return sourceForPage(job, input.pageId);
  }
  throw new Error(`not a read tool: ${name}`);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx jest tests/agentTools.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C <root> add backend/src/services/agentTools.js backend/tests/agentTools.test.js
git -C <root> commit -m "feat(agent): 工具 schema + 唯讀工具執行器"
```

---

## Task 4: 對話狀態儲存

**Files:**
- Create: `backend/src/services/conversationStore.js`
- Test: `backend/tests/conversationStore.test.js`

- [ ] **Step 1: 寫失敗測試**

`backend/tests/conversationStore.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { getConversation, resetConversation } from '../src/services/conversationStore.js';

describe('conversationStore', () => {
  it('creates a conversation with empty state', () => {
    const c = getConversation('job-1');
    expect(c.messages).toEqual([]);
    expect(c.pendingProposal).toBeNull();
    expect(c.history).toEqual([]);
  });

  it('returns the same conversation for the same job', () => {
    const a = getConversation('job-2');
    a.messages.push({ role: 'user', content: 'hi' });
    expect(getConversation('job-2').messages).toHaveLength(1);
  });

  it('resetConversation clears it', () => {
    getConversation('job-3').messages.push({ role: 'user', content: 'hi' });
    resetConversation('job-3');
    expect(getConversation('job-3').messages).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx jest tests/conversationStore.test.js`
Expected: FAIL

- [ ] **Step 3: 實作**

`backend/src/services/conversationStore.js`:
```js
const conversations = new Map();

export function getConversation(jobId) {
  if (!conversations.has(jobId)) {
    conversations.set(jobId, { jobId, messages: [], pendingProposal: null, history: [] });
  }
  return conversations.get(jobId);
}

export function resetConversation(jobId) {
  conversations.delete(jobId);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx jest tests/conversationStore.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C <root> add backend/src/services/conversationStore.js backend/tests/conversationStore.test.js
git -C <root> commit -m "feat(agent): 對話狀態儲存"
```

---

## Task 5: 套用提議 / 驗證 / 還原

**Files:**
- Create: `backend/src/services/applyChange.js`
- Test: `backend/tests/applyChange.test.js`

- [ ] **Step 1: 寫失敗測試**

`backend/tests/applyChange.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import { createJob, updateJob, getJob, JOB_STATES } from '../src/services/jobManager.js';
import { getConversation, resetConversation } from '../src/services/conversationStore.js';
import { applyProposal, undoLast, validatePage } from '../src/services/applyChange.js';
import { LEARNED_PATH, loadLearnedExamples } from '../src/knowledge/learnedExamples.js';

function seedJob() {
  const job = createJob({ tag: 't' });
  updateJob(job.id, JOB_STATES.PENDING_FIGMA, { layoutPlan: { pages: [
    { id: 'PAGE_1', type: 'jackpot', title: 'JACKPOT FEATURE', rules: ['old'] },
  ] } });
  return job;
}

describe('applyChange', () => {
  let backup;
  beforeEach(() => { backup = fs.readFileSync(LEARNED_PATH, 'utf8'); fs.writeFileSync(LEARNED_PATH, '[]'); });
  afterEach(() => { fs.writeFileSync(LEARNED_PATH, backup); });

  it('validatePage rejects missing type', () => {
    expect(() => validatePage({ id: 'PAGE_1' })).toThrow();
  });

  it('applies a page edit, snapshots old, sets PENDING_FIGMA', () => {
    const job = seedJob();
    updateJob(job.id, JOB_STATES.COMPLETE, job.result);
    const conv = getConversation(job.id);
    conv.pendingProposal = { type: 'propose_page_edit', pageId: 'PAGE_1',
      newPage: { id: 'PAGE_1', type: 'jackpot', title: 'JACKPOT FEATURE', rules: ['new'] }, summary: 's' };
    applyProposal(job.id, conv);
    const plan = getJob(job.id).result.layoutPlan;
    expect(plan.pages[0].rules).toEqual(['new']);
    expect(getJob(job.id).status).toBe(JOB_STATES.PENDING_FIGMA);
    expect(conv.history).toHaveLength(1);
    resetConversation(job.id);
  });

  it('applies an example proposal to the JSON store', () => {
    const job = seedJob();
    const conv = getConversation(job.id);
    conv.pendingProposal = { type: 'propose_example', label: 'L', input: 'in',
      output: { id: 'PAGE_1', type: 'jackpot' }, summary: 's' };
    applyProposal(job.id, conv);
    expect(loadLearnedExamples()).toHaveLength(1);
    resetConversation(job.id);
  });

  it('undoLast restores the previous page', () => {
    const job = seedJob();
    const conv = getConversation(job.id);
    conv.pendingProposal = { type: 'propose_page_edit', pageId: 'PAGE_1',
      newPage: { id: 'PAGE_1', type: 'jackpot', title: 'JACKPOT FEATURE', rules: ['new'] }, summary: 's' };
    applyProposal(job.id, conv);
    undoLast(job.id, conv);
    const plan = getJob(job.id).result.layoutPlan;
    expect(plan.pages[0].rules).toEqual(['old']);
    resetConversation(job.id);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx jest tests/applyChange.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 applyChange.js**

`backend/src/services/applyChange.js`:
```js
import { getJob, updateJob, JOB_STATES } from './jobManager.js';
import { PAGE_TYPES } from '../knowledge/baseKnowledge.js';
import { addLearnedExample } from '../knowledge/learnedExamples.js';

export function validatePage(page) {
  if (!page || typeof page !== 'object') throw new Error('newPage must be an object');
  if (!page.id) throw new Error('newPage.id is required');
  if (!page.type) throw new Error('newPage.type is required');
  if (!PAGE_TYPES[page.type]) throw new Error(`unknown page type: ${page.type}`);
  return true;
}

// 套用 conversation.pendingProposal；回傳人類可讀訊息。清空 pendingProposal。
export function applyProposal(jobId, conv) {
  const p = conv.pendingProposal;
  if (!p) throw new Error('no pending proposal');
  let message;

  if (p.type === 'propose_page_edit') {
    validatePage(p.newPage);
    const job = getJob(jobId);
    const plan = job && job.result && job.result.layoutPlan;
    if (!plan) throw new Error('no layout plan on job');
    const idx = plan.pages.findIndex((x) => x.id === p.pageId);
    if (idx === -1) throw new Error(`page not found: ${p.pageId}`);
    conv.history.push({ pageId: p.pageId, prevPage: plan.pages[idx] });
    plan.pages[idx] = p.newPage;
    updateJob(jobId, JOB_STATES.PENDING_FIGMA, { layoutPlan: plan });
    message = `已更新 ${p.pageId}，正在重畫。`;
  } else if (p.type === 'propose_example') {
    addLearnedExample({ label: p.label, input: p.input, output: p.output });
    message = `已存成學習範例「${p.label}」，下次生成立即生效。`;
  } else {
    throw new Error(`unknown proposal type: ${p.type}`);
  }

  conv.pendingProposal = null;
  return message;
}

export function undoLast(jobId, conv) {
  const snap = conv.history.pop();
  if (!snap) throw new Error('沒有可還原的修改');
  const job = getJob(jobId);
  const plan = job && job.result && job.result.layoutPlan;
  if (!plan) throw new Error('no layout plan on job');
  const idx = plan.pages.findIndex((x) => x.id === snap.pageId);
  if (idx === -1) throw new Error(`page not found: ${snap.pageId}`);
  plan.pages[idx] = snap.prevPage;
  updateJob(jobId, JOB_STATES.PENDING_FIGMA, { layoutPlan: plan });
  return `已還原 ${snap.pageId}，正在重畫。`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx jest tests/applyChange.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C <root> add backend/src/services/applyChange.js backend/tests/applyChange.test.js
git -C <root> commit -m "feat(agent): 驗證/套用提議/還原"
```

---

## Task 6: Agent 迴圈

**Files:**
- Create: `backend/src/services/agent.js`
- Test: `backend/tests/agent.test.js`

說明：`runChat` 接受一個可注入的 `createMessage(messages, tools) => Promise<response>`，測試傳入假的、production 傳入真 Anthropic 呼叫。response 形如 Anthropic SDK：`{ stop_reason, content: [{type:'text'|'tool_use', ...}] }`。

- [ ] **Step 1: 寫失敗測試**

`backend/tests/agent.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import { runChat } from '../src/services/agent.js';

const job = { _parsedContent: ' | PAGE 1 | TITLE | JACKPOT FEATURE',
  result: { layoutPlan: { pages: [{ id: 'PAGE_1', type: 'jackpot', title: 'JACKPOT FEATURE', rules: ['old'] }] } } };

function conv() { return { jobId: 'j', messages: [], pendingProposal: null, history: [] }; }

it('runs a read tool then returns a proposal', async () => {
  const responses = [
    { stop_reason: 'tool_use', content: [
      { type: 'text', text: '我先看一下這頁。' },
      { type: 'tool_use', id: 't1', name: 'get_page', input: { pageId: 'PAGE_1' } },
    ] },
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 't2', name: 'propose_page_edit', input: {
        pageId: 'PAGE_1', newPage: { id: 'PAGE_1', type: 'jackpot', rules: ['new'] }, summary: '改規則' } },
    ] },
  ];
  let i = 0;
  const createMessage = async () => responses[i++];
  const c = conv();
  const out = await runChat({ job, conversation: c, message: '改第1頁', createMessage });
  expect(out.proposal.type).toBe('propose_page_edit');
  expect(c.pendingProposal).not.toBeNull();
});

it('returns plain text when no tool is used', async () => {
  const createMessage = async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '你好' }] });
  const out = await runChat({ job, conversation: conv(), message: 'hi', createMessage });
  expect(out.proposal).toBeNull();
  expect(out.assistantText).toContain('你好');
});

it('stops at maxSteps', async () => {
  const createMessage = async () => ({ stop_reason: 'tool_use', content: [
    { type: 'tool_use', id: 'x', name: 'list_pages', input: {} },
  ] });
  const out = await runChat({ job, conversation: conv(), message: 'loop', createMessage, maxSteps: 3 });
  expect(out.proposal).toBeNull();
  expect(out.assistantText).toMatch(/上限|步/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx jest tests/agent.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 agent.js**

`backend/src/services/agent.js`:
```js
import { TOOL_DEFS, runReadTool, isProposeTool } from './agentTools.js';

const SYSTEM = `你是 AutoHelp 的修頁助理。使用者會要求修改一本已生成的遊戲說明書的某一頁，或把某頁存成學習範例。
規則：
- 先用 list_pages / get_page / get_source 了解現況，把使用者說的頁對應到正確的 page id。
- 要修改頁面時，產生「完整的一頁 JSON」並呼叫 propose_page_edit（不要只給片段）。保留原本的欄位結構，只改該改的。
- 要教模型時呼叫 propose_example，input 用 get_source 的原文、output 用修對後的整頁 JSON。
- 一律不要自行宣稱已完成；提議後交由使用者確認。
- 絕不在輸出中使用 "|" 字元。`;

function textOf(content) {
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

// createMessage(messages, tools, system) => Anthropic-like response
export async function runChat({ job, conversation, message, createMessage, maxSteps = 8, signal }) {
  conversation.messages.push({ role: 'user', content: message });
  let lastText = '';

  for (let step = 0; step < maxSteps; step++) {
    const resp = await createMessage(conversation.messages, TOOL_DEFS, SYSTEM, signal);
    conversation.messages.push({ role: 'assistant', content: resp.content });
    const t = textOf(resp.content);
    if (t) lastText = t;

    const toolUses = resp.content.filter((b) => b.type === 'tool_use');
    if (!toolUses.length) {
      return { assistantText: lastText, proposal: null };
    }

    // 提議工具：停下、存成 pending、回傳。
    const propose = toolUses.find((b) => isProposeTool(b.name));
    if (propose) {
      conversation.pendingProposal = { type: propose.name, ...propose.input };
      return { assistantText: lastText, proposal: conversation.pendingProposal };
    }

    // 唯讀工具：執行、把結果接回去。
    const results = [];
    for (const tu of toolUses) {
      try {
        const out = runReadTool(tu.name, tu.input || {}, { job });
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
      } catch (err) {
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: `ERROR: ${err.message}`, is_error: true });
      }
    }
    conversation.messages.push({ role: 'user', content: results });
  }

  return { assistantText: lastText || '（已達工具呼叫步數上限，請縮小要求或分次進行。）', proposal: null };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx jest tests/agent.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C <root> add backend/src/services/agent.js backend/tests/agent.test.js
git -C <root> commit -m "feat(agent): agent 工具迴圈（可注入 createMessage）"
```

---

## Task 7: Chat 路由 + 掛載

**Files:**
- Create: `backend/src/routes/chat.js`
- Modify: `backend/src/index.js`
- Test: `backend/tests/chat.route.test.js`

說明：production 的 `createMessage` 在此用真 Anthropic client 包一層；測試時走「已有 pendingProposal → confirm」路徑與「無 job → 400」路徑，不打真 API。

- [ ] **Step 1: 寫失敗測試**

`backend/tests/chat.route.test.js`:
```js
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
process.env.API_KEY = process.env.API_KEY || 'dev-key-12345';
import { app } from '../src/index.js';
import { createJob, updateJob, JOB_STATES, getJob } from '../src/services/jobManager.js';
import { getConversation, resetConversation } from '../src/services/conversationStore.js';

const KEY = { 'x-api-key': process.env.API_KEY };

it('rejects chat with no job', async () => {
  const res = await request(app).post('/api/v1/chat').set(KEY).send({ jobId: 'nope', message: 'hi' });
  expect(res.status).toBe(404);
});

it('confirm applies a pending page edit and re-renders', async () => {
  const job = createJob({ tag: 't' });
  updateJob(job.id, JOB_STATES.COMPLETE, { layoutPlan: { pages: [
    { id: 'PAGE_1', type: 'jackpot', title: 'J', rules: ['old'] },
  ] } });
  const conv = getConversation(job.id);
  conv.pendingProposal = { type: 'propose_page_edit', pageId: 'PAGE_1',
    newPage: { id: 'PAGE_1', type: 'jackpot', title: 'J', rules: ['new'] }, summary: 's' };

  const res = await request(app).post('/api/v1/chat/confirm').set(KEY).send({ jobId: job.id, decision: 'confirm' });
  expect(res.status).toBe(200);
  expect(getJob(job.id).result.layoutPlan.pages[0].rules).toEqual(['new']);
  expect(getJob(job.id).status).toBe(JOB_STATES.PENDING_FIGMA);
  resetConversation(job.id);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx jest tests/chat.route.test.js`
Expected: FAIL（路由不存在 → 404 但 confirm 測試會失敗）

- [ ] **Step 3: 實作 chat.js**

`backend/src/routes/chat.js`:
```js
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getJob, getLatestJob } from '../services/jobManager.js';
import { getConversation } from '../services/conversationStore.js';
import { runChat } from '../services/agent.js';
import { applyProposal, undoLast } from '../services/applyChange.js';

export const chatRoute = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 真 Anthropic 呼叫，包成 agent 需要的 createMessage 介面。
async function createMessage(messages, tools, system, signal) {
  return client.messages.create(
    { model: 'claude-sonnet-4-6', max_tokens: 4096, system, tools, messages },
    signal ? { signal } : undefined
  );
}

function resolveJob(req) {
  return req.body.jobId ? getJob(req.body.jobId) : getLatestJob();
}

chatRoute.post('/', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const job = resolveJob(req);
    if (!job) return res.status(404).json({ error: '請先生成一本說明書' });

    const conv = getConversation(job.id);
    if (conv.pendingProposal) {
      return res.json({ assistantText: '還有一個提案等你確認，請先按確認或取消。', proposal: conv.pendingProposal });
    }
    const out = await runChat({ job, conversation: conv, message, createMessage });
    res.json(out);
  } catch (err) { next(err); }
});

chatRoute.post('/confirm', (req, res, next) => {
  try {
    const { decision } = req.body;
    const job = resolveJob(req);
    if (!job) return res.status(404).json({ error: 'no job' });
    const conv = getConversation(job.id);
    if (!conv.pendingProposal) return res.status(400).json({ error: 'no pending proposal' });

    if (decision === 'confirm') {
      const message = applyProposal(job.id, conv);
      return res.json({ ok: true, message });
    }
    conv.pendingProposal = null;
    res.json({ ok: true, message: '已取消提案。' });
  } catch (err) { next(err); }
});

chatRoute.post('/undo', (req, res, next) => {
  try {
    const job = resolveJob(req);
    if (!job) return res.status(404).json({ error: 'no job' });
    const message = undoLast(job.id, getConversation(job.id));
    res.json({ ok: true, message });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: 掛載路由**

Modify `backend/src/index.js`：在其他 route import 之後加 `import { chatRoute } from './routes/chat.js';`，並在 `app.use('/api/v1/assets', assetsRoute);` 之後加：
```js
app.use('/api/v1/chat', chatRoute);
```

- [ ] **Step 5: 跑測試確認通過**

Run: `cd backend && npx jest tests/chat.route.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C <root> add backend/src/routes/chat.js backend/src/index.js backend/tests/chat.route.test.js
git -C <root> commit -m "feat(agent): /chat /confirm /undo 路由 + 掛載"
```

---

## Task 8: 整合驗證（真 Claude，不污染畫布）

**Files:** 無（手動驗證步驟）

- [ ] **Step 1: 啟動後端**

```bash
cd backend && node --env-file=.env server.js
```

- [ ] **Step 2: 先生成一本（取得 jobId）**

用網頁或 curl 對 `/api/v1/generate` 送 1JBBEu 那份 Sheet，記下 job_id（或 chat 省略 jobId 用最新）。

- [ ] **Step 3: 真 Claude 修頁提案**

```bash
curl -s -X POST http://localhost:3001/api/v1/chat -H "x-api-key: dev-key-12345" -H "Content-Type: application/json" -d "{\"message\":\"把 jackpot 那頁的第一條規則開頭改成測試\"}"
```
Expected: 回傳 `proposal.type = "propose_page_edit"`，`newPage` 是合理的整頁 JSON。

- [ ] **Step 4: 確認套用**

```bash
curl -s -X POST http://localhost:3001/api/v1/chat/confirm -H "x-api-key: dev-key-12345" -H "Content-Type: application/json" -d "{\"decision\":\"confirm\"}"
```
Expected: `{ ok: true, message: 已更新… }`，且該 job 狀態回到 `pending_figma`（Figma 在 Start Polling 時會重畫）。

- [ ] **Step 5: 提交驗證筆記（如有調整）**

```bash
git -C <root> commit --allow-empty -m "test(agent): 端對端整合驗證通過"
```

---

## Task 9: 前端 — 型別 + API client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: 加型別**

在 `frontend/src/types.ts` 檔尾加：
```ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface Proposal {
  type: 'propose_page_edit' | 'propose_example';
  summary: string;
  pageId?: string;
  newPage?: unknown;
  label?: string;
}

export interface ChatResponse {
  assistantText: string;
  proposal: Proposal | null;
}
```

- [ ] **Step 2: 加 API**

在 `frontend/src/api/client.ts` 檔尾加（沿用既有 `Settings`/`parseError` 模式）：
```ts
import type { ChatResponse } from '../types';

export async function chat(config: Settings, jobId: string | null, message: string): Promise<ChatResponse> {
  const res = await fetch(`${config.backendUrl}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify({ jobId, message }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function confirmChange(
  config: Settings, jobId: string | null, decision: 'confirm' | 'cancel'
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${config.backendUrl}/api/v1/chat/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify({ jobId, decision }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
```
（`ChatResponse` 的 import 可與檔首既有 import 合併。）

- [ ] **Step 3: 型別檢查 + Commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤
```bash
git -C <root> add frontend/src/types.ts frontend/src/api/client.ts
git -C <root> commit -m "feat(agent): 前端 chat 型別與 API client"
```

---

## Task 10: 前端 — ChatPanel + 掛入 App

**Files:**
- Create: `frontend/src/components/ChatPanel.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 建 ChatPanel**

`frontend/src/components/ChatPanel.tsx`:
```tsx
import { useState } from 'react';
import type { Settings, Job, ChatMessage, Proposal } from '../types';
import { chat, confirmChange } from '../api/client';

interface Props { config: Settings; job: Job | null; }

export default function ChatPanel({ config, job }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const jobId = job?.id ?? null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const res = await chat(config, jobId, text);
      setMessages((m) => [...m, { role: 'assistant', text: res.assistantText || '(無回應)' }]);
      setProposal(res.proposal);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `錯誤：${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'confirm' | 'cancel') {
    setBusy(true);
    try {
      const res = await confirmChange(config, jobId, decision);
      setMessages((m) => [...m, { role: 'assistant', text: res.message }]);
      setProposal(null);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `錯誤：${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">修頁助理</div>
      <div className="panel-scroll">
        <div className="feed">
          {messages.length === 0 && <div className="empty">生成後，可在這裡用對話修改某一頁。</div>}
          {messages.map((m, i) => (
            <div className={`msg ${m.role === 'user' ? 'ok' : 'status'}`} key={i}>{m.text}</div>
          ))}
        </div>
        {proposal && (
          <div className="proposal-card">
            <div className="muted" style={{ marginBottom: 6 }}>提案</div>
            <div>{proposal.summary}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => decide('confirm')} disabled={busy}>確認</button>
              <button onClick={() => decide('cancel')} disabled={busy}>取消</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={input}
          placeholder="例如：第7頁 MINI 賠率改成 1000"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <button onClick={send} disabled={busy}>送出</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 掛入 App**

Modify `frontend/src/App.tsx`：import 並在版面中（Assistant 面板附近）渲染：
```tsx
import ChatPanel from './components/ChatPanel';
```
在 JSX 中加入（settings 與 job 變數名稱依 App 既有狀態；若名稱不同請對應）：
```tsx
<ChatPanel config={settings} job={job} />
```

- [ ] **Step 3: 型別檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 4: 手動冒煙測試**

啟動前後端，生成一本後在「修頁助理」輸入「把 jackpot 第一條規則開頭改成測試」→ 出現提案 → 按確認 → Figma（Start Polling 中）重畫。

- [ ] **Step 5: Commit + Push**

```bash
git -C <root> add frontend/src/components/ChatPanel.tsx frontend/src/App.tsx
git -C <root> commit -m "feat(agent): 前端 ChatPanel 對話修頁介面"
git -C <root> push origin main
```

---

## Self-Review 註記

- **規格覆蓋**：5 工具(Task3)、對話狀態(Task4)、驗證/套用/還原(Task5)、迴圈+8步上限+可中斷 signal(Task6)、/chat /confirm /undo(Task7)、教模型存 JSON(Task1/5)、前端對話+確認卡(Task9/10)、測試(每 Task)、整合驗證(Task8) 皆有對應。
- **確認機制**：mutation 僅經 `/confirm`，agent 迴圈遇 propose_* 即停（Task6），符合「必經確認」。
- **可中斷**：`createMessage` 傳入 `signal`；前端 Stop 串接可於後續加（v1 後端已支援）。
- **型別一致**：`createMessage(messages, tools, system, signal)`、`runChat({job,conversation,message,createMessage,maxSteps,signal})`、`applyProposal(jobId, conv)`、`undoLast(jobId, conv)`、`pendingProposal = { type, ...input }` 全計畫一致。
