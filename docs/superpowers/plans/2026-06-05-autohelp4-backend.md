# AutoHelp 4.0 — Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js REST API that accepts any document input, calls Claude API to analyze the content, and outputs a JSON Layout Plan ready for the Figma Bridge Plugin.

**Architecture:** Express.js server with in-memory job store. `documentParser` normalizes Google Sheets URL or plain text into structured rows. `claudeAnalyzer` sends normalized content + page-type knowledge to Claude API and returns a validated JSON Layout Plan. Routes expose `/api/v1/generate` and `/api/v1/jobs/:id`.

**Tech Stack:** Node.js 20+, Express 4, @anthropic-ai/sdk, node-fetch, Jest + Supertest

---

## File Map

```
AutoHelp4.0/backend/
├── package.json
├── .env.example
├── .gitignore
├── src/
│   ├── index.js                  # Express server entry point
│   ├── routes/
│   │   ├── generate.js           # POST /api/v1/generate
│   │   └── jobs.js               # GET  /api/v1/jobs/:id
│   ├── services/
│   │   ├── jobManager.js         # In-memory job store + state machine
│   │   ├── documentParser.js     # Google Sheets URL / text → row objects
│   │   └── claudeAnalyzer.js     # Claude API call → JSON Layout Plan
│   └── knowledge/
│       └── baseKnowledge.js      # Page type descriptions for system prompt
└── tests/
    ├── jobManager.test.js
    ├── documentParser.test.js
    ├── claudeAnalyzer.test.js
    └── routes.test.js
```

---

## Task 1: Project Setup

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/src/index.js`

- [ ] **Step 1: Create the backend directory and package.json**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0"
mkdir backend
cd backend
```

Create `backend/package.json`:
```json
{
  "name": "autohelp4-backend",
  "version": "1.0.0",
  "description": "AutoHelp 4.0 Backend API Service",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.54.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "node-fetch": "^3.3.2",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  },
  "type": "module"
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create .env.example and .gitignore**

Create `backend/.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
API_KEY=your-secret-api-key-here
PORT=3001
```

Create `backend/.gitignore`:
```
node_modules/
.env
*.log
```

- [ ] **Step 4: Create the Express server entry point**

Create `backend/src/index.js`:
```javascript
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { generateRoute } from './routes/generate.js';
import { jobsRoute } from './routes/jobs.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', version: '4.0.0' }));
app.use('/api/v1/generate', generateRoute);
app.use('/api/v1/jobs', jobsRoute);

app.listen(PORT, () => console.log(`AutoHelp 4.0 backend running on port ${PORT}`));

export { app };
```

- [ ] **Step 5: Create a .env file for local development**

Create `backend/.env`:
```
ANTHROPIC_API_KEY=<your real key>
API_KEY=dev-key-12345
PORT=3001
```

- [ ] **Step 6: Verify the server starts (will fail on missing routes — that's OK)**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
node src/index.js
```

Expected error about missing route files. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0"
git init backend
cd backend
git add package.json .env.example .gitignore src/index.js
git commit -m "feat: project setup — Express server skeleton"
```

---

## Task 2: Job Manager Service

**Files:**
- Create: `backend/src/services/jobManager.js`
- Create: `backend/tests/jobManager.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jobManager.test.js`:
```javascript
import { createJob, getJob, updateJob, JOB_STATES } from '../src/services/jobManager.js';

test('createJob returns job with queued status and unique id', () => {
  const job = createJob({ document: { type: 'text', value: 'hello' }, language: 'en' });
  expect(job.id).toBeDefined();
  expect(job.status).toBe(JOB_STATES.QUEUED);
  expect(job.input.language).toBe('en');
  expect(job.createdAt).toBeDefined();
});

test('getJob returns null for unknown id', () => {
  expect(getJob('nonexistent')).toBeNull();
});

test('getJob returns job after creation', () => {
  const job = createJob({ document: { type: 'text', value: 'test' }, language: 'en' });
  expect(getJob(job.id)).toEqual(job);
});

test('updateJob changes status and merges result', () => {
  const job = createJob({ document: { type: 'text', value: 'test' }, language: 'en' });
  updateJob(job.id, JOB_STATES.COMPLETE, { layoutPlan: { pages: [] } });
  const updated = getJob(job.id);
  expect(updated.status).toBe(JOB_STATES.COMPLETE);
  expect(updated.result.layoutPlan.pages).toEqual([]);
});

test('updateJob sets error on failed status', () => {
  const job = createJob({ document: { type: 'text', value: 'test' }, language: 'en' });
  updateJob(job.id, JOB_STATES.FAILED, null, 'Something went wrong');
  const updated = getJob(job.id);
  expect(updated.status).toBe(JOB_STATES.FAILED);
  expect(updated.error).toBe('Something went wrong');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
node --experimental-vm-modules node_modules/.bin/jest tests/jobManager.test.js
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement jobManager.js**

Create `backend/src/services/jobManager.js`:
```javascript
import { v4 as uuidv4 } from 'uuid';

export const JOB_STATES = {
  QUEUED: 'queued',
  ANALYZING: 'analyzing',
  AI_PROCESSING: 'ai_processing',
  PENDING_FIGMA: 'pending_figma',
  RENDERING: 'rendering',
  COMPLETE: 'complete',
  FAILED: 'failed',
};

const jobs = new Map();

export function createJob(input) {
  const job = {
    id: uuidv4(),
    status: JOB_STATES.QUEUED,
    input,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function updateJob(id, status, result = null, error = null) {
  const job = jobs.get(id);
  if (!job) throw new Error(`Job ${id} not found`);
  job.status = status;
  job.result = result;
  job.error = error;
  job.updatedAt = new Date().toISOString();
  return job;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/jobManager.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/jobManager.js tests/jobManager.test.js
git commit -m "feat: job manager service with state machine"
```

---

## Task 3: Document Parser

**Files:**
- Create: `backend/src/services/documentParser.js`
- Create: `backend/tests/documentParser.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/documentParser.test.js`:
```javascript
import { parseDocument } from '../src/services/documentParser.js';

test('parseDocument passthrough for plain text', async () => {
  const result = await parseDocument({ type: 'text', value: 'PAGE 1\tPAYTABLE\tSome rule' });
  expect(result.type).toBe('text');
  expect(result.content).toContain('PAGE 1');
  expect(result.rowCount).toBeGreaterThan(0);
});

test('parseDocument rejects unknown type', async () => {
  await expect(parseDocument({ type: 'unknown', value: '' }))
    .rejects.toThrow('Unsupported document type');
});

test('parseDocument extracts rows from TSV text', async () => {
  const tsv = 'PAGE 1\tPAYTABLE\tRule 1\nPAGE 2\tSCATTER\tRule 2';
  const result = await parseDocument({ type: 'text', value: tsv });
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0][0]).toBe('PAGE 1');
  expect(result.rows[0][1]).toBe('PAYTABLE');
});

test('parseDocument handles sheets_url with valid sheet id', async () => {
  // This test uses a real public sheet — skip in CI if no network
  const url = 'https://docs.google.com/spreadsheets/d/1IEOyYtRHQn3Go1CAzV1UdWco54YySdZ7-sLHlMoyhzw/edit';
  const result = await parseDocument({ type: 'sheets_url', value: url });
  expect(result.type).toBe('sheets');
  expect(result.rows.length).toBeGreaterThan(0);
}, 15000);
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/documentParser.test.js --testPathPattern=documentParser
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement documentParser.js**

Create `backend/src/services/documentParser.js`:
```javascript
import fetch from 'node-fetch';

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function parseCSV(csvText) {
  return csvText
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      // Handle quoted fields
      const row = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += line[i];
        }
      }
      row.push(current.trim());
      return row;
    });
}

function parseTSV(text) {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.split('\t').map(cell => cell.trim()));
}

function rowsToContent(rows) {
  return rows.map(row => row.join(' | ')).join('\n');
}

export async function parseDocument(input) {
  if (input.type === 'text') {
    const rows = parseTSV(input.value);
    return {
      type: 'text',
      content: rowsToContent(rows),
      rows,
      rowCount: rows.length,
    };
  }

  if (input.type === 'sheets_url') {
    const sheetId = extractSheetId(input.value);
    if (!sheetId) throw new Error('Invalid Google Sheets URL');

    // Use gviz CSV export (public sheets, no API key needed)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    return {
      type: 'sheets',
      content: rowsToContent(rows),
      rows,
      rowCount: rows.length,
    };
  }

  throw new Error(`Unsupported document type: ${input.type}`);
}
```

- [ ] **Step 4: Run tests (skip network test if offline)**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/documentParser.test.js --testNamePattern="passthrough|rejects|extracts rows"
```

Expected: PASS (3 tests, network test optional)

- [ ] **Step 5: Commit**

```bash
git add src/services/documentParser.js tests/documentParser.test.js
git commit -m "feat: document parser — Google Sheets URL and plain text"
```

---

## Task 4: Knowledge Base

**Files:**
- Create: `backend/src/knowledge/baseKnowledge.js`

- [ ] **Step 1: Create the knowledge base file**

Create `backend/src/knowledge/baseKnowledge.js`:
```javascript
// Page type descriptions extracted from 83 reference images.
// Used as part of Claude's system prompt to recognize content types.

export const PAGE_TYPES = {
  paytable: {
    description: 'Symbol payout table showing winning combinations and their values',
    recognition: [
      'Contains symbol names (M1, M2, C1, C2, A, K, Q, J, 10)',
      'Has numeric payout values with count ranges (e.g. "8-9: 400", "5: 125")',
      'Mentions BET MULTIPLIER',
      'May group gold/base symbols separately',
    ],
    requiredFields: ['title', 'rules', 'symbols'],
    optionalFields: ['groups'],
  },
  symbols_per_play: {
    description: 'Table showing which symbols are active per bet level',
    recognition: [
      'Has BET column with numeric values',
      'Has SYMBOLS column with symbol names',
      'Some symbols marked as removed (X marks or strikethrough)',
      'Title: "SYMBOLS PER PLAY" or "游戏中标志"',
    ],
    requiredFields: ['title', 'bets'],
    optionalFields: ['note'],
  },
  prizes_table: {
    description: 'Two-column table showing bet amounts and prize ranges',
    recognition: [
      'Has BET column with amounts',
      'Has prize range column (e.g. "19 ~ 128" or "28 ~ 888")',
      'Many rows of bet/prize pairs',
      'Title like "NEW APPEARED PRIZES" or "PRIZES (CONTINUED)"',
    ],
    requiredFields: ['title', 'rows'],
    optionalFields: ['note'],
  },
  feature_text: {
    description: 'Simple page with title and bullet-point rules',
    recognition: [
      'Single title (e.g. "CASCADING REELS FEATURE", "GAME RULES", "FREE GAMES FEATURE")',
      'Bullet points with game rules',
      'No complex table structure',
      'May include inline symbol references like [C1]',
    ],
    requiredFields: ['title', 'body'],
    optionalFields: [],
  },
  jackpot: {
    description: 'Jackpot feature page with denomination table',
    recognition: [
      'Title contains "JACKPOT FEATURE"',
      'Lists jackpot tiers: GRAND, MAJOR, MINOR, MINI',
      'Has DENOMINATION table (empty cells = dynamic values)',
      'Rules about how jackpot is triggered',
    ],
    requiredFields: ['title', 'rules', 'jackpotTiers', 'denominationTable'],
    optionalFields: [],
  },
  setting_info: {
    description: 'Setting information table with min/max values',
    recognition: [
      'Title: "SETTING INFORMATION"',
      'Table with MINIMUM and MAXIMUM columns',
      'Rows: WAYS, TOTAL BET, etc.',
      'May have denomination section with button descriptions',
    ],
    requiredFields: ['title', 'rows'],
    optionalFields: ['denominationSections'],
  },
  special_feature: {
    description: 'Feature page with sub-feature sections and inline icons',
    recognition: [
      'Title describes a special game feature (GOLDEN SYMBOL, WILD FEATURE, etc.)',
      'Has sub-sections with dash bullets',
      'Inline symbol references embedded in text',
      'More complex layout than feature_text',
    ],
    requiredFields: ['title', 'sections'],
    optionalFields: ['note'],
  },
  multi_section: {
    description: 'Page with main title, body text, sub-titles, and optional table',
    recognition: [
      'Has a main title and main body text',
      'Has 2+ sub-sections each with their own sub-title',
      'Sub-sections may have icons/assets',
      'May include a value table at the bottom',
    ],
    requiredFields: ['title', 'body', 'sections'],
    optionalFields: ['table'],
  },
  game_settings: {
    description: 'Game board layout page showing reel grid',
    recognition: [
      'Title: "GAME SETTINGS"',
      'Shows reel/board grid (empty placeholder or actual layout)',
      'States number of reels and height',
      'Includes cluster win requirements',
      'Has intellectual property announcement',
    ],
    requiredFields: ['title', 'boardInfo'],
    optionalFields: ['copyright'],
  },
  spin_button: {
    description: 'Spin button description with icon',
    recognition: [
      'Title: "SPIN BUTTON"',
      'Has spin button icon/asset reference',
      'Short description of button functions',
    ],
    requiredFields: ['title', 'icon', 'body'],
    optionalFields: [],
  },
  fortune_chance: {
    description: 'Fortune Chance feature description',
    recognition: [
      'Title: "FORTUNE CHANCE"',
      'Describes what happens when credit balance is low',
      'References CURRENCY DISPLAY MODE',
      'Has button icon references',
    ],
    requiredFields: ['title', 'body'],
    optionalFields: [],
  },
  instant_bonus: {
    description: 'Instant Bonus purchase feature description',
    recognition: [
      'Title: "INSTANT BONUS"',
      'Describes purchasing free games',
      'Mentions cost (100X total bet)',
      'Has button icon reference',
    ],
    requiredFields: ['title', 'body'],
    optionalFields: [],
  },
  combo_feature: {
    description: 'Combo feature with two distinct effects',
    recognition: [
      'Title: "COMBO FEATURE"',
      'Has exactly two sub-effects: MULTIPLIER DROP and SYMBOL CONVERSION',
      'Each effect has its own sub-title and rules',
    ],
    requiredFields: ['title', 'triggerRules', 'effects'],
    optionalFields: [],
  },
  custom: {
    description: 'Fallback for unrecognized page types',
    recognition: ['Does not clearly match any known type'],
    requiredFields: ['title', 'content'],
    optionalFields: [],
  },
};

export function buildKnowledgePrompt() {
  let prompt = 'KNOWN PAGE TYPES:\n\n';
  for (const [type, info] of Object.entries(PAGE_TYPES)) {
    prompt += `TYPE: ${type}\n`;
    prompt += `Description: ${info.description}\n`;
    prompt += `Recognition signals:\n`;
    info.recognition.forEach(r => { prompt += `  - ${r}\n`; });
    prompt += `Required JSON fields: ${info.requiredFields.join(', ')}\n\n`;
  }
  return prompt;
}
```

- [ ] **Step 2: Verify it exports correctly**

```bash
node -e "import('./src/knowledge/baseKnowledge.js').then(m => console.log(Object.keys(m.PAGE_TYPES).join(', ')))"
```

Expected output: `paytable, symbols_per_play, prizes_table, feature_text, jackpot, setting_info, special_feature, multi_section, game_settings, spin_button, fortune_chance, instant_bonus, combo_feature, custom`

- [ ] **Step 3: Commit**

```bash
git add src/knowledge/baseKnowledge.js
git commit -m "feat: knowledge base — 14 page type definitions for Claude system prompt"
```

---

## Task 5: Claude Analyzer

**Files:**
- Create: `backend/src/services/claudeAnalyzer.js`
- Create: `backend/tests/claudeAnalyzer.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/claudeAnalyzer.test.js`:
```javascript
import { buildSystemPrompt, validateLayoutPlan } from '../src/services/claudeAnalyzer.js';

test('buildSystemPrompt includes all page types', () => {
  const prompt = buildSystemPrompt();
  expect(prompt).toContain('paytable');
  expect(prompt).toContain('feature_text');
  expect(prompt).toContain('jackpot');
  expect(prompt).toContain('JSON Layout Plan');
});

test('validateLayoutPlan accepts valid plan', () => {
  const plan = {
    pages: [
      { id: 'PAGE_1', type: 'feature_text', title: 'TEST', body: ['Rule 1'] }
    ]
  };
  expect(() => validateLayoutPlan(plan)).not.toThrow();
});

test('validateLayoutPlan rejects plan without pages array', () => {
  expect(() => validateLayoutPlan({})).toThrow('Layout plan must have a pages array');
});

test('validateLayoutPlan rejects page without id', () => {
  expect(() => validateLayoutPlan({ pages: [{ type: 'feature_text' }] }))
    .toThrow('Page at index 0 missing id');
});

test('validateLayoutPlan rejects page without type', () => {
  expect(() => validateLayoutPlan({ pages: [{ id: 'P1' }] }))
    .toThrow('Page at index 0 missing type');
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/claudeAnalyzer.test.js
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement claudeAnalyzer.js**

Create `backend/src/services/claudeAnalyzer.js`:
```javascript
import Anthropic from '@anthropic-ai/sdk';
import { buildKnowledgePrompt } from '../knowledge/baseKnowledge.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function buildSystemPrompt() {
  return `You are a game help page layout analyzer for slot machine games.

Your job is to analyze game help documentation text and output a structured JSON Layout Plan.

${buildKnowledgePrompt()}

STRICT OUTPUT RULES:
1. Output ONLY valid JSON — no markdown, no explanation, no code fences
2. The root object must have a "pages" array
3. Every page must have "id" (e.g. "PAGE_1") and "type" (one of the known types)
4. Page IDs must be sequential: PAGE_1, PAGE_2, etc.
5. If content is ambiguous, use type "custom" with a "content" field
6. Inline asset references like [C1], [C2] should be preserved as-is in text fields
7. Dynamic placeholder values (min bet, max bet, denomination) should use {PLACEHOLDER} format

JSON SCHEMA FOR EACH PAGE TYPE:

feature_text: { id, type, title, body: [string] }
paytable: { id, type, title, rules: [string], symbols: [{asset, payouts: [{range, value}]}] }
symbols_per_play: { id, type, title, note, bets: [{amount, activeSymbols: [string], removedSymbols: [string]}] }
prizes_table: { id, type, title, note, rows: [{bet, min, max}] }
jackpot: { id, type, title, rules: [string], jackpotTiers: [string], denominationTable: { rows: [string], columns: [string] } }
setting_info: { id, type, title, rows: [{label, min, max}], denominationSections: [{label, body}] }
special_feature: { id, type, title, note, sections: [{subtitle, body: [string]}] }
multi_section: { id, type, title, body: [string], sections: [{subtitle, icon, body: [string]}], table }
game_settings: { id, type, title, boardInfo: {reels, height, clusterMin, scatterMin}, copyright }
spin_button: { id, type, title, icon, body: string }
fortune_chance: { id, type, title, body: [string] }
instant_bonus: { id, type, title, body: [string] }
combo_feature: { id, type, title, triggerRules: [string], effects: [{name, rules: [string]}] }
custom: { id, type, title, content: string }`;
}

export function validateLayoutPlan(plan) {
  if (!plan || !Array.isArray(plan.pages)) {
    throw new Error('Layout plan must have a pages array');
  }
  plan.pages.forEach((page, i) => {
    if (!page.id) throw new Error(`Page at index ${i} missing id`);
    if (!page.type) throw new Error(`Page at index ${i} missing type`);
  });
  return plan;
}

export async function analyzeDocument(parsedDocument, language = 'en') {
  const systemPrompt = buildSystemPrompt();
  const userMessage = `Analyze the following game help document and output a JSON Layout Plan.

Language: ${language}
Total rows: ${parsedDocument.rowCount}

Document content:
${parsedDocument.content}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = message.content[0].text.trim();

  // Strip markdown code fences if Claude added them
  const jsonText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

  let plan;
  try {
    plan = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON: ${e.message}\nRaw: ${rawText.slice(0, 200)}`);
  }

  return validateLayoutPlan(plan);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/claudeAnalyzer.test.js
```

Expected: PASS (5 tests — no API call made in unit tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/claudeAnalyzer.js tests/claudeAnalyzer.test.js
git commit -m "feat: claude analyzer — system prompt + layout plan validation"
```

---

## Task 6: Routes — Generate + Jobs

**Files:**
- Create: `backend/src/routes/generate.js`
- Create: `backend/src/routes/jobs.js`
- Create: `backend/tests/routes.test.js`

- [ ] **Step 1: Write the failing route tests**

Create `backend/tests/routes.test.js`:
```javascript
import request from 'supertest';
import { app } from '../src/index.js';

const HEADERS = { 'x-api-key': 'dev-key-12345' };

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('POST /api/v1/generate without API key returns 401', async () => {
  const res = await request(app).post('/api/v1/generate').send({});
  expect(res.status).toBe(401);
});

test('POST /api/v1/generate with missing document returns 400', async () => {
  const res = await request(app)
    .post('/api/v1/generate')
    .set(HEADERS)
    .send({ language: 'en' });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('document');
});

test('POST /api/v1/generate with valid input returns job_id', async () => {
  const res = await request(app)
    .post('/api/v1/generate')
    .set(HEADERS)
    .send({
      document: { type: 'text', value: 'PAGE 1\tPAYTABLE\tTest rule' },
      language: 'en',
      theme: 'dark',
    });
  expect(res.status).toBe(202);
  expect(res.body.job_id).toBeDefined();
  expect(res.body.status).toBe('queued');
}, 10000);

test('GET /api/v1/jobs/:id returns 404 for unknown job', async () => {
  const res = await request(app)
    .get('/api/v1/jobs/nonexistent')
    .set(HEADERS);
  expect(res.status).toBe(404);
});

test('GET /api/v1/jobs/:id returns job after creation', async () => {
  const createRes = await request(app)
    .post('/api/v1/generate')
    .set(HEADERS)
    .send({
      document: { type: 'text', value: 'PAGE 1\tGAME RULES\tMalfunction voids all pays' },
      language: 'en',
    });
  const { job_id } = createRes.body;
  const res = await request(app).get(`/api/v1/jobs/${job_id}`).set(HEADERS);
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(job_id);
}, 10000);
```

- [ ] **Step 2: Run to verify they fail**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/routes.test.js
```

Expected: FAIL — route modules not found

- [ ] **Step 3: Implement generate.js route**

Create `backend/src/routes/generate.js`:
```javascript
import { Router } from 'express';
import { createJob, updateJob, JOB_STATES } from '../services/jobManager.js';
import { parseDocument } from '../services/documentParser.js';
import { analyzeDocument } from '../services/claudeAnalyzer.js';

export const generateRoute = Router();

generateRoute.post('/', async (req, res) => {
  const { document, language = 'en', theme = 'dark', figma_file_key, figma_page } = req.body;

  if (!document || !document.type || document.value === undefined) {
    return res.status(400).json({ error: 'document.type and document.value are required' });
  }

  const job = createJob({ document, language, theme, figma_file_key, figma_page });
  res.status(202).json({ job_id: job.id, status: job.status });

  // Process asynchronously (do not await)
  processJob(job.id, { document, language, theme }).catch(err => {
    console.error(`Job ${job.id} failed:`, err);
  });
});

async function processJob(jobId, { document, language, theme }) {
  try {
    updateJob(jobId, JOB_STATES.ANALYZING);
    const parsed = await parseDocument(document);

    updateJob(jobId, JOB_STATES.AI_PROCESSING);
    const layoutPlan = await analyzeDocument(parsed, language);
    layoutPlan.meta = { job_id: jobId, language, theme };

    updateJob(jobId, JOB_STATES.PENDING_FIGMA, { layoutPlan });
  } catch (err) {
    updateJob(jobId, JOB_STATES.FAILED, null, err.message);
  }
}
```

- [ ] **Step 4: Implement jobs.js route**

Create `backend/src/routes/jobs.js`:
```javascript
import { Router } from 'express';
import { getJob } from '../services/jobManager.js';

export const jobsRoute = Router();

jobsRoute.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const response = {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
  };

  if (job.result) {
    response.layoutPlan = job.result.layoutPlan;
  }

  res.json(response);
});
```

- [ ] **Step 5: Run route tests**

```bash
node --experimental-vm-modules node_modules/.bin/jest tests/routes.test.js
```

Expected: PASS (6 tests — the generate tests will queue but not wait for Claude)

- [ ] **Step 6: Run full test suite**

```bash
node --experimental-vm-modules node_modules/.bin/jest
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/routes/generate.js src/routes/jobs.js tests/routes.test.js
git commit -m "feat: REST routes — POST /generate and GET /jobs/:id"
```

---

## Task 7: End-to-End Smoke Test

**Files:**
- Create: `backend/smoke-test.js` (manual test script, not committed)

- [ ] **Step 1: Start the server**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
node src/index.js
```

Expected: `AutoHelp 4.0 backend running on port 3001`

- [ ] **Step 2: Test health endpoint (new terminal)**

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","version":"4.0.0"}`

- [ ] **Step 3: Submit a generation job using the real test sheet**

```bash
curl -X POST http://localhost:3001/api/v1/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key-12345" \
  -d "{\"document\":{\"type\":\"sheets_url\",\"value\":\"https://docs.google.com/spreadsheets/d/1IEOyYtRHQn3Go1CAzV1UdWco54YySdZ7-sLHlMoyhzw/edit\"},\"language\":\"en\",\"theme\":\"dark\"}"
```

Expected: `{"job_id":"<uuid>","status":"queued"}`

- [ ] **Step 4: Poll the job until complete**

```bash
# Replace <job_id> with the actual ID from previous step
curl http://localhost:3001/api/v1/jobs/<job_id> -H "x-api-key: dev-key-12345"
```

Poll every 10 seconds until `status` is `pending_figma` or `failed`.

- [ ] **Step 5: Inspect the Layout Plan**

When status is `pending_figma`, the response should include `layoutPlan.pages` with correctly typed pages.

Expected minimum: 10+ pages with types matching the sheet content (paytable, feature_text, jackpot, etc.)

- [ ] **Step 6: Final commit with any fixes found during smoke test**

```bash
git add -A
git commit -m "test: smoke test passed — backend pipeline end-to-end working"
```

---

## Post-Plan Notes

- `PENDING_FIGMA` status means the layout plan is ready; the Bridge Plugin (Plan B) will pick it up
- The backend uses in-memory storage — restarting the server clears all jobs (acceptable for Phase 1)
- Add `CORS` origin restriction and HTTPS before deploying to cloud
- Claude model `claude-sonnet-4-5` can be changed in `claudeAnalyzer.js` line 43
- Google Sheets fetched via public CSV export — no API key needed for public sheets
