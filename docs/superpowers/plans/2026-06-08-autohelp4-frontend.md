# AutoHelp 4.0 — Frontend Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser workspace where a user (1) uploads symbol/UI images, then (2) pastes a Google Sheet URL or text, picks language/theme, and presses one button to generate a Layout Plan — watching live status as the backend analyzes the document and hands off to the Figma Bridge.

**Architecture:** Vite + React + TypeScript single-page app, plain CSS (no Tailwind). A pure `api/client.ts` wraps the backend REST endpoints (config passed in, fetch-mockable). `settings.ts` persists backend URL + API key to localStorage. `App.tsx` owns orchestration: generate → poll job → narrate progress in an assistant feed, plus the asset library state. Three presentational panels: AssistantPanel (left), DocumentPanel (middle), AssetPanel (right).

**Tech Stack:** Vite 5, React 18, TypeScript 5, Vitest 2 (api client tests), plain CSS

---

## File Map

```
frontend/
├── package.json
├── vite.config.ts          # React plugin + vitest (node env)
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── .env.example
├── .gitignore
└── src/
    ├── main.tsx
    ├── App.tsx             # orchestration + layout
    ├── index.css          # design system + layout
    ├── types.ts           # shared types
    ├── settings.ts        # localStorage settings
    ├── api/
    │   ├── client.ts      # REST wrappers
    │   └── client.test.ts # vitest unit tests
    └── components/
        ├── AssistantPanel.tsx
        ├── DocumentPanel.tsx
        ├── AssetPanel.tsx
        └── SettingsBar.tsx
```

---

## Task 1: Scaffold Vite + React + TypeScript

**Files:** create the project skeleton (no `npm create` — write files directly to avoid interactive prompts).

- [ ] **Step 1: Create the frontend directory**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0"
mkdir frontend
```

- [ ] **Step 2: Create `frontend/package.json`**

```json
{
  "name": "autohelp4-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AutoHelp 4.0</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create a minimal `frontend/src/App.tsx` placeholder**

```tsx
export default function App() {
  return <div>AutoHelp 4.0</div>;
}
```

- [ ] **Step 9: Create a minimal `frontend/src/index.css` placeholder**

```css
body { margin: 0; font-family: sans-serif; }
```

- [ ] **Step 10: Create `frontend/.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 11: Create `frontend/.env.example`**

```
VITE_BACKEND_URL=http://localhost:3001
VITE_API_KEY=dev-key-12345
```

- [ ] **Step 12: Install dependencies**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\frontend"
npm install
```
Expected: node_modules created, no errors.

- [ ] **Step 13: Verify the build works**

```bash
npm run build
```
Expected: `dist/` produced, no TypeScript or build errors.

- [ ] **Step 14: Commit**

```bash
git add package.json vite.config.ts tsconfig.json tsconfig.node.json index.html .gitignore .env.example src/main.tsx src/App.tsx src/index.css
git commit -m "feat: frontend scaffold — Vite + React + TypeScript"
```

---

## Task 2: Types, Settings, API Client (with tests)

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/settings.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```typescript
export type Language = 'en' | 'sch';
export type Theme = 'dark' | 'light';
export type DocSourceType = 'sheets_url' | 'text';

export type JobStatus =
  | 'queued'
  | 'analyzing'
  | 'ai_processing'
  | 'pending_figma'
  | 'rendering'
  | 'complete'
  | 'failed';

export interface Settings {
  backendUrl: string;
  apiKey: string;
}

export interface GenerateRequest {
  document: { type: DocSourceType; value: string };
  language: Language;
  theme: Theme;
  figma_file_key?: string;
  figma_page?: string;
}

export interface GenerateResponse {
  job_id: string;
  status: JobStatus;
}

export interface LayoutPage {
  id: string;
  type: string;
  title?: string;
}

export interface LayoutPlan {
  meta?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  pages: LayoutPage[];
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  layoutPlan?: LayoutPlan;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  ext: string;
  bgRemoved: boolean;
  original_url: string;
  transparent_url: string;
}
```

- [ ] **Step 2: Create `frontend/src/settings.ts`**

```typescript
import type { Settings } from './types';

const KEY = 'autohelp4-settings';

const DEFAULTS: Settings = {
  backendUrl: (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001',
  apiKey: (import.meta.env.VITE_API_KEY as string) || 'dev-key-12345',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
```

- [ ] **Step 3: Write the failing API client tests**

Create `frontend/src/api/client.test.ts`:
```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generate, getJob, listAssets, deleteAsset } from './client';
import type { Settings } from '../types';

const config: Settings = { backendUrl: 'http://test.local', apiKey: 'k123' };

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe('generate', () => {
  test('posts to /api/v1/generate with api key header and returns job', async () => {
    const fetchMock = mockFetch(202, { job_id: 'j1', status: 'queued' });
    vi.stubGlobal('fetch', fetchMock);

    const res = await generate(config, {
      document: { type: 'text', value: 'PAGE 1' },
      language: 'en',
      theme: 'dark',
    });

    expect(res.job_id).toBe('j1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test.local/api/v1/generate');
    expect((opts as RequestInit).method).toBe('POST');
    expect((opts as any).headers['x-api-key']).toBe('k123');
  });

  test('throws on non-2xx', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { error: 'bad' }));
    await expect(
      generate(config, { document: { type: 'text', value: '' }, language: 'en', theme: 'dark' })
    ).rejects.toThrow('bad');
  });
});

describe('getJob', () => {
  test('fetches /api/v1/jobs/:id', async () => {
    const fetchMock = mockFetch(200, { id: 'j1', status: 'complete' });
    vi.stubGlobal('fetch', fetchMock);
    const job = await getJob(config, 'j1');
    expect(job.status).toBe('complete');
    expect(fetchMock.mock.calls[0][0]).toBe('http://test.local/api/v1/jobs/j1');
  });
});

describe('listAssets', () => {
  test('returns the assets array', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { assets: [{ id: 'a1', name: 'C1' }] }));
    const assets = await listAssets(config);
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('C1');
  });
});

describe('deleteAsset', () => {
  test('sends DELETE and resolves', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await deleteAsset(config, 'a1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test.local/api/v1/assets/a1');
    expect((opts as RequestInit).method).toBe('DELETE');
  });
});
```

- [ ] **Step 4: Run to verify failure**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\frontend"
npm test
```
Expected: FAIL — client module not found

- [ ] **Step 5: Implement `frontend/src/api/client.ts`**

```typescript
import type {
  Settings,
  GenerateRequest,
  GenerateResponse,
  Job,
  Asset,
} from '../types';

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function generate(
  config: Settings,
  body: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch(`${config.backendUrl}/api/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getJob(config: Settings, id: string): Promise<Job> {
  const res = await fetch(`${config.backendUrl}/api/v1/jobs/${id}`, {
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function listAssets(config: Settings): Promise<Asset[]> {
  const res = await fetch(`${config.backendUrl}/api/v1/assets`, {
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return body.assets as Asset[];
}

export async function uploadAsset(
  config: Settings,
  file: File,
  name: string,
  type: string
): Promise<Asset> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  form.append('type', type);
  const res = await fetch(`${config.backendUrl}/api/v1/assets/upload`, {
    method: 'POST',
    headers: { 'x-api-key': config.apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteAsset(config: Settings, id: string): Promise<void> {
  const res = await fetch(`${config.backendUrl}/api/v1/assets/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test
```
Expected: PASS (6 tests)

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/settings.ts src/api/client.ts src/api/client.test.ts
git commit -m "feat: types, settings persistence, and tested API client"
```

---

## Task 3: Design System CSS + App Shell + SettingsBar

**Files:**
- Modify: `frontend/src/index.css` (full design system)
- Create: `frontend/src/components/SettingsBar.tsx`
- Modify: `frontend/src/App.tsx` (shell layout — panels added in Task 5)

- [ ] **Step 1: Replace `frontend/src/index.css` with the design system**

```css
:root {
  --bg: #14142b;
  --panel: #1b1b3a;
  --panel-2: #16213e;
  --border: #2a2a52;
  --border-soft: #23234a;
  --accent: #f0c040;
  --accent-2: #e67e22;
  --text: #e6e6f0;
  --muted: #9a9ab5;
  --danger: #f1948a;
  --ok: #82e0aa;
  --radius: 10px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Noto Sans TC', sans-serif;
  font-size: 14px;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input, select, textarea {
  font-family: inherit;
  background: #0f1530;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 11px;
  font-size: 13px;
  outline: none;
  width: 100%;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); }
label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; }

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--panel-2);
  border-bottom: 1px solid var(--border);
}
.brand { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
.brand .accent {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.brand .ver { color: var(--muted); font-size: 11px; margin-left: 8px; font-weight: 400; }

.workspace {
  display: grid;
  grid-template-columns: 320px 1fr 360px;
  gap: 16px;
  padding: 16px;
  flex: 1;
  min-height: 0;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.panel-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 12px;
}
.panel-scroll { overflow-y: auto; flex: 1; min-height: 0; }

.field { margin-bottom: 12px; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.btn {
  border: 1px solid var(--border);
  background: #0f1530;
  color: var(--text);
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  transition: all 0.15s;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn-primary {
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #1a1a2e;
  font-weight: 700;
  letter-spacing: 1px;
  width: 100%;
  padding: 12px;
}
.btn-primary:hover { opacity: 0.92; color: #1a1a2e; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm { padding: 5px 9px; font-size: 12px; }
.btn-danger:hover { border-color: var(--danger); color: var(--danger); }

.seg { display: flex; gap: 6px; }
.seg button {
  flex: 1;
  border: 1px solid var(--border);
  background: #0f1530;
  color: var(--muted);
  border-radius: 8px;
  padding: 8px;
  font-size: 12px;
}
.seg button.active { border-color: var(--accent); color: var(--accent); background: #1a2247; }

/* Assistant feed */
.feed { display: flex; flex-direction: column; gap: 10px; }
.msg {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border-soft);
  font-size: 13px;
  line-height: 1.5;
}
.msg.status { border-left: 3px solid var(--accent); }
.msg.error { border-left: 3px solid var(--danger); color: var(--danger); }
.msg.ok { border-left: 3px solid var(--ok); color: var(--ok); }
.msg .ts { display: block; font-size: 10px; color: var(--muted); margin-top: 4px; }

/* Job status */
.statusline { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); }
.dot.active { background: var(--accent); animation: pulse 1s infinite; }
.dot.done { background: var(--ok); }
.dot.err { background: var(--danger); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.plan-summary { margin-top: 10px; }
.chip {
  display: inline-block;
  background: #1a2247;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  margin: 0 6px 6px 0;
}

/* Asset grid */
.asset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.asset-card {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  text-align: center;
  position: relative;
}
.asset-thumb {
  width: 100%;
  height: 70px;
  object-fit: contain;
  background: repeating-conic-gradient(#2a2a45 0% 25%, #20203a 0% 50%) 50% / 16px 16px;
  border-radius: 6px;
  margin-bottom: 6px;
}
.asset-name { font-size: 12px; font-weight: 600; }
.asset-meta { font-size: 10px; color: var(--muted); }
.badge {
  position: absolute; top: 4px; right: 4px;
  font-size: 9px; padding: 1px 6px; border-radius: 999px;
  background: var(--ok); color: #0a2a12;
}
.badge.passthrough { background: var(--muted); color: #1a1a2e; }
.asset-del {
  position: absolute; top: 4px; left: 4px;
  background: rgba(0,0,0,0.5); border: none; color: #fff;
  border-radius: 6px; width: 20px; height: 20px; font-size: 12px; line-height: 1;
}
.asset-del:hover { background: var(--danger); }

.dropzone {
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 18px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 12px;
  transition: all 0.15s;
}
.dropzone.drag { border-color: var(--accent); color: var(--accent); }

.muted { color: var(--muted); font-size: 12px; }
.empty { text-align: center; color: var(--muted); padding: 24px 0; font-size: 13px; }

/* Settings popover */
.settings-pop {
  position: absolute; right: 20px; top: 52px; z-index: 50;
  background: var(--panel); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; width: 320px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}
```

- [ ] **Step 2: Create `frontend/src/components/SettingsBar.tsx`**

```tsx
import { useState } from 'react';
import type { Settings } from '../types';

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
}

export default function SettingsBar({ settings, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);

  function save() {
    onSave({ backendUrl: backendUrl.trim().replace(/\/$/, ''), apiKey: apiKey.trim() });
    setOpen(false);
  }

  return (
    <div>
      <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>
        ⚙ Settings
      </button>
      {open && (
        <div className="settings-pop">
          <div className="field">
            <label>Backend URL</label>
            <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
          </div>
          <div className="field">
            <label>API Key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" />
          </div>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Replace `frontend/src/App.tsx` with the shell (panels wired in Task 5)**

```tsx
import { useState } from 'react';
import SettingsBar from './components/SettingsBar';
import { loadSettings, saveSettings } from './settings';
import type { Settings } from './types';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());

  function updateSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="accent">AutoHelp</span>
          <span className="ver">4.0 — Web Workspace</span>
        </div>
        <SettingsBar settings={settings} onSave={updateSettings} />
      </div>
      <div className="workspace">
        <div className="panel">
          <div className="panel-title">Assistant</div>
          <div className="panel-scroll muted">Status will appear here.</div>
        </div>
        <div className="panel">
          <div className="panel-title">Document</div>
          <div className="panel-scroll muted">Document input coming up.</div>
        </div>
        <div className="panel">
          <div className="panel-title">Assets</div>
          <div className="panel-scroll muted">Asset library coming up.</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and build**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\frontend"
npm run typecheck && npm run build
```
Expected: no errors, dist/ produced

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/SettingsBar.tsx src/App.tsx
git commit -m "feat: design system CSS + app shell + settings bar"
```

---

## Task 4: Asset Panel (list, upload, delete)

**Files:**
- Create: `frontend/src/components/AssetPanel.tsx`

- [ ] **Step 1: Create `frontend/src/components/AssetPanel.tsx`**

```tsx
import { useRef, useState } from 'react';
import type { Asset } from '../types';

interface Props {
  assets: Asset[];
  uploading: boolean;
  onUpload: (file: File, name: string, type: string) => void;
  onDelete: (id: string) => void;
}

export default function AssetPanel({ assets, uploading, onUpload, onDelete }: Props) {
  const [drag, setDrag] = useState(false);
  const [type, setType] = useState('symbol');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.[^.]+$/, '');
      onUpload(file, name, type);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Assets ({assets.length})</div>

      <div className="seg" style={{ marginBottom: 10 }}>
        {['symbol', 'ui', 'reference'].map((t) => (
          <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>

      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : `Drop images here or click to upload (${type})`}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="panel-scroll">
        {assets.length === 0 ? (
          <div className="empty">No assets yet.<br />Upload your symbol images.</div>
        ) : (
          <div className="asset-grid">
            {assets.map((a) => (
              <div className="asset-card" key={a.id}>
                <button className="asset-del" onClick={() => onDelete(a.id)} title="Delete">×</button>
                <span className={`badge ${a.bgRemoved ? '' : 'passthrough'}`}>
                  {a.bgRemoved ? 'BG✓' : 'raw'}
                </span>
                <img className="asset-thumb" src={a.transparent_url} alt={a.name} />
                <div className="asset-name">{a.name}</div>
                <div className="asset-meta">{a.type}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\frontend"
npm run typecheck
```
Expected: no errors (the component is not yet imported — typecheck still passes since it's valid TS)

- [ ] **Step 3: Commit**

```bash
git add src/components/AssetPanel.tsx
git commit -m "feat: asset panel — upload, library grid, delete"
```

---

## Task 5: Document Panel, Assistant Panel, and Orchestration

**Files:**
- Create: `frontend/src/components/DocumentPanel.tsx`
- Create: `frontend/src/components/AssistantPanel.tsx`
- Modify: `frontend/src/App.tsx` (full orchestration: generate, poll, feed, assets)

- [ ] **Step 1: Create `frontend/src/components/DocumentPanel.tsx`**

```tsx
import { useState } from 'react';
import type { DocSourceType, Language, Theme } from '../types';

export interface GenerateParams {
  sourceType: DocSourceType;
  value: string;
  language: Language;
  theme: Theme;
  figmaFileKey: string;
}

interface Props {
  busy: boolean;
  onGenerate: (p: GenerateParams) => void;
}

export default function DocumentPanel({ busy, onGenerate }: Props) {
  const [sourceType, setSourceType] = useState<DocSourceType>('sheets_url');
  const [value, setValue] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [figmaFileKey, setFigmaFileKey] = useState('');

  const canGenerate = value.trim().length > 0 && !busy;

  return (
    <div className="panel">
      <div className="panel-title">Document</div>
      <div className="panel-scroll">
        <div className="field">
          <label>Source</label>
          <div className="seg">
            <button className={sourceType === 'sheets_url' ? 'active' : ''} onClick={() => setSourceType('sheets_url')}>
              Google Sheet URL
            </button>
            <button className={sourceType === 'text' ? 'active' : ''} onClick={() => setSourceType('text')}>
              Paste text
            </button>
          </div>
        </div>

        <div className="field">
          {sourceType === 'sheets_url' ? (
            <input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <textarea
              placeholder="Paste tab-separated rows here…"
              value={value}
              rows={8}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </div>

        <div className="row-2">
          <div className="field">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              <option value="en">English</option>
              <option value="sch">中文 (SCH)</option>
            </select>
          </div>
          <div className="field">
            <label>Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Figma File Key (optional)</label>
          <input placeholder="abc123…" value={figmaFileKey} onChange={(e) => setFigmaFileKey(e.target.value)} />
        </div>

        <button
          className="btn-primary"
          disabled={!canGenerate}
          onClick={() => onGenerate({ sourceType, value: value.trim(), language, theme, figmaFileKey: figmaFileKey.trim() })}
        >
          {busy ? 'Generating…' : '⚡ Generate'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/AssistantPanel.tsx`**

```tsx
import type { Job } from '../types';

export interface FeedMessage {
  id: number;
  kind: 'status' | 'error' | 'ok';
  text: string;
  ts: string;
}

interface Props {
  feed: FeedMessage[];
  job: Job | null;
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  analyzing: 'Reading document',
  ai_processing: 'Analyzing with AI',
  pending_figma: 'Ready for Figma',
  rendering: 'Rendering in Figma',
  complete: 'Complete',
  failed: 'Failed',
};

export default function AssistantPanel({ feed, job }: Props) {
  const dotClass =
    job?.status === 'complete' || job?.status === 'pending_figma'
      ? 'done'
      : job?.status === 'failed'
      ? 'err'
      : job
      ? 'active'
      : '';

  const planTypes = job?.layoutPlan?.pages?.map((p) => p.type) ?? [];
  const typeCounts = planTypes.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="panel">
      <div className="panel-title">Assistant</div>
      <div className="panel-scroll">
        {job && (
          <div className="statusline">
            <span className={`dot ${dotClass}`} />
            <strong>{STATUS_LABEL[job.status] || job.status}</strong>
          </div>
        )}

        {job?.layoutPlan && (
          <div className="plan-summary">
            <div className="muted" style={{ marginBottom: 6 }}>
              {job.layoutPlan.pages.length} pages
            </div>
            {Object.entries(typeCounts).map(([t, n]) => (
              <span className="chip" key={t}>{t} ×{n}</span>
            ))}
          </div>
        )}

        <div className="feed" style={{ marginTop: 14 }}>
          {feed.length === 0 ? (
            <div className="empty">
              Upload your symbols, paste a document, and press Generate.
            </div>
          ) : (
            feed.map((m) => (
              <div className={`msg ${m.kind}`} key={m.id}>
                {m.text}
                <span className="ts">{m.ts}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `frontend/src/App.tsx` with full orchestration**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import SettingsBar from './components/SettingsBar';
import AssistantPanel, { type FeedMessage } from './components/AssistantPanel';
import DocumentPanel, { type GenerateParams } from './components/DocumentPanel';
import AssetPanel from './components/AssetPanel';
import { loadSettings, saveSettings } from './settings';
import { generate, getJob, listAssets, uploadAsset, deleteAsset } from './api/client';
import type { Settings, Job, Asset } from './types';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [feed, setFeed] = useState<FeedMessage[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<number | null>(null);
  const feedId = useRef(0);

  const addFeed = useCallback((kind: FeedMessage['kind'], text: string) => {
    feedId.current += 1;
    setFeed((f) => [
      ...f,
      { id: feedId.current, kind, text, ts: new Date().toLocaleTimeString() },
    ]);
  }, []);

  const refreshAssets = useCallback(async () => {
    try {
      setAssets(await listAssets(settings));
    } catch (e) {
      addFeed('error', `Could not load assets: ${(e as Error).message}`);
    }
  }, [settings, addFeed]);

  useEffect(() => {
    refreshAssets();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refreshAssets]);

  function updateSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
    addFeed('status', 'Settings saved.');
  }

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleGenerate(p: GenerateParams) {
    stopPolling();
    setBusy(true);
    setJob(null);
    addFeed('status', `Submitting ${p.sourceType === 'sheets_url' ? 'Google Sheet' : 'pasted text'}…`);

    try {
      const res = await generate(settings, {
        document: { type: p.sourceType, value: p.value },
        language: p.language,
        theme: p.theme,
        figma_file_key: p.figmaFileKey || undefined,
      });
      addFeed('status', `Job ${res.job_id.slice(0, 8)} queued. Working…`);
      pollRef.current = window.setInterval(() => pollJob(res.job_id), 2000);
    } catch (e) {
      addFeed('error', `Generate failed: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  async function pollJob(id: string) {
    try {
      const j = await getJob(settings, id);
      setJob(j);
      if (j.status === 'pending_figma') {
        stopPolling();
        setBusy(false);
        addFeed('ok', `Layout ready — ${j.layoutPlan?.pages.length ?? 0} pages. Open the Figma Bridge plugin and press Start Polling to render.`);
      } else if (j.status === 'complete') {
        stopPolling();
        setBusy(false);
        addFeed('ok', 'Rendered in Figma. Done!');
      } else if (j.status === 'failed') {
        stopPolling();
        setBusy(false);
        addFeed('error', `Job failed: ${j.error || 'unknown error'}`);
      }
    } catch (e) {
      stopPolling();
      setBusy(false);
      addFeed('error', `Polling error: ${(e as Error).message}`);
    }
  }

  async function handleUpload(file: File, name: string, type: string) {
    setUploading(true);
    try {
      await uploadAsset(settings, file, name, type);
      addFeed('status', `Uploaded ${name}.`);
      await refreshAssets();
    } catch (e) {
      addFeed('error', `Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAsset(settings, id);
      await refreshAssets();
    } catch (e) {
      addFeed('error', `Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="accent">AutoHelp</span>
          <span className="ver">4.0 — Web Workspace</span>
        </div>
        <SettingsBar settings={settings} onSave={updateSettings} />
      </div>
      <div className="workspace">
        <AssistantPanel feed={feed} job={job} />
        <DocumentPanel busy={busy} onGenerate={handleGenerate} />
        <AssetPanel
          assets={assets}
          uploading={uploading}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, test, and build**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\frontend"
npm run typecheck && npm test && npm run build
```
Expected: typecheck clean, 6 tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentPanel.tsx src/components/AssistantPanel.tsx src/App.tsx
git commit -m "feat: document panel, assistant feed, and full generate/poll orchestration"
```

---

## Task 6: Dev Run Verification + README

**Files:**
- Create: `frontend/README.md`

- [ ] **Step 1: Create `frontend/README.md`**

```markdown
# AutoHelp 4.0 — Frontend

Browser workspace for the AutoHelp 4.0 game-manual generator.

## Run locally

1. Start the backend (port 3001):
   ```
   cd ../backend && npm start
   ```
2. Start the frontend dev server:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:5173

## Configure

Click ⚙ Settings to set the Backend URL and API Key (defaults: http://localhost:3001 / dev-key-12345). Stored in localStorage.

## Flow

1. Upload symbol/UI images in the Assets panel (right). Backgrounds are removed automatically if the backend has a Remove.bg key.
2. Paste a Google Sheet URL or text in the Document panel (middle), pick language + theme, press Generate.
3. Watch progress in the Assistant panel (left). When status is "Ready for Figma", open the Figma Bridge plugin and press Start Polling to render.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm test` — API client unit tests (Vitest)
- `npm run typecheck` — TypeScript check
```

- [ ] **Step 2: Start the dev server in the background and verify it serves**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\frontend"
npm run build
```
Confirm the build output reports success (this is the reliable non-interactive gate; the dev server is verified manually by the user).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: frontend README with run + usage instructions"
```

---

## Post-Plan Notes

- The "Assistant" panel is a guided status feed, not yet a free-form conversational agent — that (a `/api/v1/chat` endpoint backed by Claude) is a future enhancement.
- Asset thumbnails load from the backend's public `/static/assets/...` route; the backend must be running for images to appear.
- End-to-end generation still requires a real `ANTHROPIC_API_KEY` in the backend `.env`.
- To deploy: `npm run build` → host `dist/` on Vercel/Netlify; set `VITE_BACKEND_URL` + `VITE_API_KEY` at build time (or rely on the in-app Settings).
