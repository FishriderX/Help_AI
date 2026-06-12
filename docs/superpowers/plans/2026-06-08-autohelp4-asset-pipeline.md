# AutoHelp 4.0 — Backend Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload symbol/UI images to the backend, auto-remove their backgrounds, and automatically attach the matching transparent images to every generated Layout Plan so the Figma Bridge embeds real artwork instead of gray placeholders.

**Architecture:** A disk-backed `assetStore` keeps images under `backend/storage/assets/{original,transparent}/` with an in-memory index persisted to `index.json`. `bgRemover` calls Remove.bg when a key is configured and gracefully falls back to passthrough otherwise. The `assets` route handles upload/list/delete via multer. `assetInjector` scans each Layout Plan for asset name references and builds `plan.assets` with public URLs. Asset images are served by a public (auth-exempt) static route so the Figma Bridge can fetch them.

**Tech Stack:** Node.js 20, Express, multer (multipart), node-fetch, Jest + Supertest

---

## File Map

```
backend/
├── src/
│   ├── services/
│   │   ├── assetStore.js        # NEW — disk-backed image store + index
│   │   ├── bgRemover.js         # NEW — Remove.bg with passthrough fallback
│   │   └── assetInjector.js     # NEW — scan plan, build plan.assets
│   ├── routes/
│   │   └── assets.js            # NEW — POST /upload, GET /, DELETE /:id
│   ├── routes/generate.js       # MODIFY — call injectAssets in pipeline
│   └── index.js                 # MODIFY — static serve + mount assets route
├── tests/
│   ├── assetStore.test.js       # NEW
│   ├── bgRemover.test.js        # NEW
│   ├── assetInjector.test.js    # NEW
│   └── assets.route.test.js     # NEW
└── storage/assets/              # NEW (gitignored) — runtime image storage
```

---

## Task 1: Asset Store Service

**Files:**
- Create: `backend/src/services/assetStore.js`
- Create: `backend/tests/assetStore.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/assetStore.test.js`:
```javascript
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

// Use a temp dir BEFORE importing the module
const TMP = path.join(os.tmpdir(), `autohelp-assets-${Date.now()}`);
process.env.ASSET_STORAGE_DIR = TMP;

const { addAsset, setTransparent, listAssets, getAsset, findByName, deleteAsset, getStorageDir, _reset } =
  await import('../src/services/assetStore.js');

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

beforeEach(async () => {
  await _reset();
  await fs.rm(TMP, { recursive: true, force: true });
});

test('getStorageDir returns the configured temp dir', () => {
  expect(getStorageDir()).toBe(TMP);
});

test('addAsset writes original file and returns a record', async () => {
  const rec = await addAsset({ name: 'C1', type: 'symbol', ext: 'png', buffer: Buffer.from('fake-png') });
  expect(rec.id).toBeDefined();
  expect(rec.name).toBe('C1');
  expect(rec.bgRemoved).toBe(false);
  const onDisk = await fs.readFile(path.join(TMP, 'original', `${rec.id}.png`));
  expect(onDisk.toString()).toBe('fake-png');
});

test('setTransparent writes transparent file and flags record', async () => {
  const rec = await addAsset({ name: 'C2', type: 'symbol', ext: 'png', buffer: Buffer.from('orig') });
  await setTransparent(rec.id, Buffer.from('transparent'), true);
  const updated = await getAsset(rec.id);
  expect(updated.bgRemoved).toBe(true);
  expect(updated.hasTransparent).toBe(true);
  const onDisk = await fs.readFile(path.join(TMP, 'transparent', `${rec.id}.png`));
  expect(onDisk.toString()).toBe('transparent');
});

test('findByName is case-insensitive', async () => {
  await addAsset({ name: 'SpinButton', type: 'ui', ext: 'png', buffer: Buffer.from('x') });
  const found = await findByName('spinbutton');
  expect(found).not.toBeNull();
  expect(found.name).toBe('SpinButton');
});

test('listAssets returns all added assets', async () => {
  await addAsset({ name: 'A', type: 'symbol', ext: 'png', buffer: Buffer.from('a') });
  await addAsset({ name: 'B', type: 'symbol', ext: 'png', buffer: Buffer.from('b') });
  const all = await listAssets();
  expect(all).toHaveLength(2);
});

test('deleteAsset removes record and files', async () => {
  const rec = await addAsset({ name: 'D', type: 'symbol', ext: 'png', buffer: Buffer.from('d') });
  const ok = await deleteAsset(rec.id);
  expect(ok).toBe(true);
  expect(await getAsset(rec.id)).toBeNull();
});

test('index persists across _reset (reload from disk)', async () => {
  await addAsset({ name: 'Persist', type: 'symbol', ext: 'png', buffer: Buffer.from('p') });
  await _reset();
  const found = await findByName('Persist');
  expect(found).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
npm test -- tests/assetStore.test.js
```
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement assetStore.js**

Create `backend/src/services/assetStore.js`:
```javascript
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, '..', '..', 'storage', 'assets');

function storageDir() {
  return process.env.ASSET_STORAGE_DIR || DEFAULT_DIR;
}
function originalDir() { return path.join(storageDir(), 'original'); }
function transparentDir() { return path.join(storageDir(), 'transparent'); }
function indexPath() { return path.join(storageDir(), 'index.json'); }

let assets = new Map();
let loaded = false;

async function ensureDirs() {
  await fs.mkdir(originalDir(), { recursive: true });
  await fs.mkdir(transparentDir(), { recursive: true });
}

async function load() {
  if (loaded) return;
  await ensureDirs();
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const arr = JSON.parse(raw);
    assets = new Map(arr.map((r) => [r.id, r]));
  } catch (e) {
    assets = new Map();
  }
  loaded = true;
}

async function persist() {
  await ensureDirs();
  await fs.writeFile(indexPath(), JSON.stringify(Array.from(assets.values()), null, 2));
}

export function getStorageDir() {
  return storageDir();
}

export async function addAsset({ name, type, ext, buffer }) {
  await load();
  const id = uuidv4();
  const safeExt = (ext || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
  const record = {
    id,
    name,
    type: type || 'symbol',
    ext: safeExt,
    bgRemoved: false,
    hasTransparent: false,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(originalDir(), `${id}.${safeExt}`), buffer);
  assets.set(id, record);
  await persist();
  return record;
}

export async function setTransparent(id, buffer, bgRemoved) {
  await load();
  const record = assets.get(id);
  if (!record) throw new Error(`Asset ${id} not found`);
  await fs.writeFile(path.join(transparentDir(), `${id}.${record.ext}`), buffer);
  record.bgRemoved = !!bgRemoved;
  record.hasTransparent = true;
  await persist();
  return record;
}

export async function listAssets() {
  await load();
  return Array.from(assets.values());
}

export async function getAsset(id) {
  await load();
  return assets.get(id) || null;
}

export async function findByName(name) {
  await load();
  const lower = (name || '').toLowerCase();
  for (const r of assets.values()) {
    if (r.name.toLowerCase() === lower) return r;
  }
  return null;
}

export async function deleteAsset(id) {
  await load();
  const record = assets.get(id);
  if (!record) return false;
  try { await fs.unlink(path.join(originalDir(), `${id}.${record.ext}`)); } catch (e) {}
  try { await fs.unlink(path.join(transparentDir(), `${id}.${record.ext}`)); } catch (e) {}
  assets.delete(id);
  await persist();
  return true;
}

// Test helper: clear in-memory state so the next call reloads from disk
export async function _reset() {
  assets = new Map();
  loaded = false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/assetStore.test.js
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/assetStore.js tests/assetStore.test.js
git commit -m "feat: asset store — disk-backed image storage with in-memory index"
```

---

## Task 2: Background Remover Service

**Files:**
- Create: `backend/src/services/bgRemover.js`
- Create: `backend/tests/bgRemover.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/bgRemover.test.js`:
```javascript
import { removeBackground } from '../src/services/bgRemover.js';

beforeEach(() => {
  delete process.env.REMOVE_BG_API_KEY;
});

test('passthrough when no API key configured', async () => {
  const input = Buffer.from('original-image-bytes');
  const { buffer, bgRemoved } = await removeBackground(input, 'png');
  expect(bgRemoved).toBe(false);
  expect(buffer).toBe(input);
});

test('returns an object with buffer and bgRemoved fields', async () => {
  const result = await removeBackground(Buffer.from('x'), 'png');
  expect(result).toHaveProperty('buffer');
  expect(result).toHaveProperty('bgRemoved');
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/bgRemover.test.js
```
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement bgRemover.js**

Create `backend/src/services/bgRemover.js`:
```javascript
// Removes an image background using the Remove.bg API.
// Falls back to passthrough (returns the original buffer, bgRemoved=false)
// when no REMOVE_BG_API_KEY is configured or the API call fails.
export async function removeBackground(buffer, ext) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return { buffer, bgRemoved: false };
  }

  try {
    const form = new FormData();
    form.append('image_file', new Blob([buffer]), `image.${ext || 'png'}`);
    form.append('size', 'auto');

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    });

    if (!res.ok) {
      return { buffer, bgRemoved: false };
    }

    const arrayBuf = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuf), bgRemoved: true };
  } catch (e) {
    return { buffer, bgRemoved: false };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/bgRemover.test.js
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/bgRemover.js tests/bgRemover.test.js
git commit -m "feat: background remover — Remove.bg with passthrough fallback"
```

---

## Task 3: Asset Injector Service

**Files:**
- Create: `backend/src/services/assetInjector.js`
- Create: `backend/tests/assetInjector.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/assetInjector.test.js`:
```javascript
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

const TMP = path.join(os.tmpdir(), `autohelp-inject-${Date.now()}`);
process.env.ASSET_STORAGE_DIR = TMP;
process.env.PUBLIC_BASE_URL = 'http://localhost:3001';

const { collectAssetNames, injectAssets } = await import('../src/services/assetInjector.js');
const { addAsset, _reset } = await import('../src/services/assetStore.js');

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

beforeEach(async () => {
  await _reset();
  await fs.rm(TMP, { recursive: true, force: true });
});

test('collectAssetNames pulls names from symbols, icon, sections, bets', () => {
  const plan = {
    pages: [
      { type: 'paytable', symbols: [{ asset: 'M1' }, { asset: 'M2' }] },
      { type: 'spin_button', icon: 'SpinButton' },
      { type: 'multi_section', sections: [{ icon: 'C2' }, { icon: 'C3' }] },
      { type: 'symbols_per_play', bets: [{ activeSymbols: ['A', 'K'], removedSymbols: ['Q'] }] },
    ],
  };
  const names = collectAssetNames(plan);
  expect(names.sort()).toEqual(['A', 'C2', 'C3', 'K', 'M1', 'M2', 'Q', 'SpinButton'].sort());
});

test('collectAssetNames returns empty array for plan with no assets', () => {
  expect(collectAssetNames({ pages: [{ type: 'feature_text', title: 'X', body: ['y'] }] })).toEqual([]);
});

test('injectAssets only includes assets that exist in the store', async () => {
  await addAsset({ name: 'M1', type: 'symbol', ext: 'png', buffer: Buffer.from('m1') });
  const plan = { pages: [{ type: 'paytable', symbols: [{ asset: 'M1' }, { asset: 'MISSING' }] }] };
  await injectAssets(plan);
  expect(Object.keys(plan.assets)).toEqual(['M1']);
  expect(plan.assets.M1.transparent_url).toContain('/static/assets/');
  expect(plan.assets.M1.type).toBe('symbol');
});

test('injectAssets sets empty assets object when nothing matches', async () => {
  const plan = { pages: [{ type: 'paytable', symbols: [{ asset: 'NOPE' }] }] };
  await injectAssets(plan);
  expect(plan.assets).toEqual({});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/assetInjector.test.js
```
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement assetInjector.js**

Create `backend/src/services/assetInjector.js`:
```javascript
import { findByName } from './assetStore.js';

// Scans a Layout Plan for every asset name referenced by its pages.
export function collectAssetNames(plan) {
  const names = new Set();
  const add = (n) => { if (n && typeof n === 'string') names.add(n); };

  for (const page of (plan.pages || [])) {
    add(page.icon);
    for (const s of (page.symbols || [])) add(s.asset);
    for (const sec of (page.sections || [])) add(sec.icon);
    for (const bet of (page.bets || [])) {
      for (const a of (bet.activeSymbols || [])) add(a);
      for (const a of (bet.removedSymbols || [])) add(a);
    }
  }
  return Array.from(names);
}

// Builds plan.assets with public URLs for every referenced name that exists in
// the asset store. Unknown names are omitted (the Bridge renders a placeholder).
export async function injectAssets(plan) {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
  const names = collectAssetNames(plan);
  const assets = {};

  for (const name of names) {
    const record = await findByName(name);
    if (!record) continue;
    const originalUrl = `${base}/static/assets/original/${record.id}.${record.ext}`;
    const transparentUrl = record.hasTransparent
      ? `${base}/static/assets/transparent/${record.id}.${record.ext}`
      : originalUrl;
    assets[name] = {
      type: record.type,
      original_url: originalUrl,
      transparent_url: transparentUrl,
      bg_removed: record.bgRemoved,
    };
  }

  plan.assets = assets;
  return plan;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/assetInjector.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/assetInjector.js tests/assetInjector.test.js
git commit -m "feat: asset injector — scan plan and attach matching asset URLs"
```

---

## Task 4: Assets Route + Pipeline Integration

**Files:**
- Modify: `backend/package.json` (add multer dependency)
- Create: `backend/src/routes/assets.js`
- Modify: `backend/src/routes/generate.js` (call injectAssets)
- Modify: `backend/src/index.js` (static serving + mount route)
- Modify: `backend/.gitignore` (ignore storage/)
- Create: `backend/tests/assets.route.test.js`

- [ ] **Step 1: Add multer and install**

Edit `backend/package.json` — add to `dependencies` (keep alphabetical-ish, valid JSON):
```json
"multer": "^1.4.5-lts.1",
```

Then install:
```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
npm install
```
Expected: multer added, no errors.

- [ ] **Step 2: Write the failing route tests**

Create `backend/tests/assets.route.test.js`:
```javascript
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

const TMP = path.join(os.tmpdir(), `autohelp-route-${Date.now()}`);
process.env.ASSET_STORAGE_DIR = TMP;
process.env.API_KEY = 'dev-key-12345';
process.env.PUBLIC_BASE_URL = 'http://localhost:3001';

const request = (await import('supertest')).default;
const { app } = await import('../src/index.js');

const HEADERS = { 'x-api-key': 'dev-key-12345' };

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

test('POST /api/v1/assets/upload without file returns 400', async () => {
  const res = await request(app).post('/api/v1/assets/upload').set(HEADERS);
  expect(res.status).toBe(400);
});

test('POST /api/v1/assets/upload stores an asset and returns urls', async () => {
  const res = await request(app)
    .post('/api/v1/assets/upload')
    .set(HEADERS)
    .field('name', 'C1')
    .field('type', 'symbol')
    .attach('file', Buffer.from('fake-image-bytes'), 'C1.png');
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
  expect(res.body.name).toBe('C1');
  expect(res.body.original_url).toContain('/static/assets/original/');
  expect(res.body.transparent_url).toContain('/static/assets/transparent/');
});

test('GET /api/v1/assets lists uploaded assets', async () => {
  const res = await request(app).get('/api/v1/assets').set(HEADERS);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.assets)).toBe(true);
  expect(res.body.assets.length).toBeGreaterThan(0);
});

test('uploaded image is publicly served without API key', async () => {
  const up = await request(app)
    .post('/api/v1/assets/upload')
    .set(HEADERS)
    .field('name', 'Public1')
    .attach('file', Buffer.from('served-bytes'), 'Public1.png');
  const urlPath = up.body.original_url.replace('http://localhost:3001', '');
  const res = await request(app).get(urlPath); // no auth header
  expect(res.status).toBe(200);
});

test('DELETE /api/v1/assets/:id removes an asset', async () => {
  const up = await request(app)
    .post('/api/v1/assets/upload')
    .set(HEADERS)
    .field('name', 'ToDelete')
    .attach('file', Buffer.from('x'), 'ToDelete.png');
  const res = await request(app).delete(`/api/v1/assets/${up.body.id}`).set(HEADERS);
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});
```

- [ ] **Step 3: Run to verify failure**

```bash
npm test -- tests/assets.route.test.js
```
Expected: FAIL — assets route not mounted / module not found

- [ ] **Step 4: Implement assets.js route**

Create `backend/src/routes/assets.js`:
```javascript
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { addAsset, setTransparent, listAssets, getAsset, deleteAsset } from '../services/assetStore.js';
import { removeBackground } from '../services/bgRemover.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const assetsRoute = Router();

function toDto(r) {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    ext: r.ext,
    bgRemoved: r.bgRemoved,
    original_url: `${base}/static/assets/original/${r.id}.${r.ext}`,
    transparent_url: r.hasTransparent
      ? `${base}/static/assets/transparent/${r.id}.${r.ext}`
      : `${base}/static/assets/original/${r.id}.${r.ext}`,
  };
}

assetsRoute.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required (multipart field "file")' });
    }
    const originalName = req.file.originalname || 'asset.png';
    const ext = (path.extname(originalName).replace('.', '') || 'png').toLowerCase();
    const name = (req.body.name || '').trim() || path.basename(originalName, path.extname(originalName));
    const type = req.body.type || 'symbol';

    const record = await addAsset({ name, type, ext, buffer: req.file.buffer });

    // Remove background (passthrough fallback when no key / on failure)
    try {
      const { buffer: outBuf, bgRemoved } = await removeBackground(req.file.buffer, ext);
      await setTransparent(record.id, outBuf, bgRemoved);
    } catch (e) {
      await setTransparent(record.id, req.file.buffer, false);
    }

    const updated = await getAsset(record.id);
    res.status(201).json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

assetsRoute.get('/', async (req, res, next) => {
  try {
    const all = await listAssets();
    res.json({ assets: all.map(toDto) });
  } catch (err) {
    next(err);
  }
});

assetsRoute.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteAsset(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Asset not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Wire injectAssets into generate.js**

Edit `backend/src/routes/generate.js`. Add the import after the existing imports:
```javascript
import { injectAssets } from '../services/assetInjector.js';
```

Then in `processJob`, replace this block:
```javascript
    const layoutPlan = await analyzeDocument(parsed, language);
    layoutPlan.meta = { job_id: jobId, language, theme };

    updateJob(jobId, JOB_STATES.PENDING_FIGMA, { layoutPlan });
```
with:
```javascript
    const layoutPlan = await analyzeDocument(parsed, language);
    layoutPlan.meta = { job_id: jobId, language, theme };
    await injectAssets(layoutPlan);

    updateJob(jobId, JOB_STATES.PENDING_FIGMA, { layoutPlan });
```

- [ ] **Step 6: Wire static serving + assets route into index.js**

Edit `backend/src/index.js`. Add imports after the existing route imports:
```javascript
import { assetsRoute } from './routes/assets.js';
import { getStorageDir } from './services/assetStore.js';
```

Add the public static route IMMEDIATELY AFTER `app.use(express.json());` and BEFORE the auth middleware (so images need no API key):
```javascript
// Public asset images (no auth — the Figma Bridge fetches these directly)
app.use('/static/assets', express.static(getStorageDir()));
```

Add the assets route mount after `app.use('/api/v1/bridge', bridgeRoute);`:
```javascript
app.use('/api/v1/assets', assetsRoute);
```

- [ ] **Step 7: Ignore the storage directory**

Edit `backend/.gitignore` — append:
```
storage/
```

- [ ] **Step 8: Run the route tests**

```bash
npm test -- tests/assets.route.test.js
```
Expected: PASS (5 tests)

- [ ] **Step 9: Run the FULL test suite (nothing regressed)**

```bash
npm test
```
Expected: All tests pass (20 original + 7 + 2 + 4 + 5 = 38 tests)

- [ ] **Step 10: Commit**

```bash
git add src/routes/assets.js src/routes/generate.js src/index.js package.json package-lock.json .gitignore tests/assets.route.test.js
git commit -m "feat: assets route + static serving + inject assets into generate pipeline"
```

---

## Task 5: Smoke Test

**Files:** none (manual verification)

- [ ] **Step 1: Start the server**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
node src/index.js
```
Expected: `AutoHelp 4.0 backend running on port 3001`

- [ ] **Step 2: Upload a real reference image (new terminal)**

```bash
curl -s -X POST http://localhost:3001/api/v1/assets/upload \
  -H "x-api-key: dev-key-12345" \
  -F "name=TestSym" \
  -F "type=symbol" \
  -F "file=@C:/Users/leolu/Desktop/新增資料夾/專案資料夾/AutoHelp4.0/Help_0605/PAGE 1_英文版.png"
```
Expected: 201 JSON with `original_url` and `transparent_url`.

- [ ] **Step 3: List assets**

```bash
curl -s http://localhost:3001/api/v1/assets -H "x-api-key: dev-key-12345"
```
Expected: JSON array containing TestSym.

- [ ] **Step 4: Fetch the served image (no auth)**

```bash
curl -s -o NUL -w "%{http_code}" "http://localhost:3001/static/assets/original/<ID>.png"
```
Replace `<ID>` with the id from step 2. Expected: `200`

- [ ] **Step 5: Stop the server (Ctrl+C) and commit any fixes**

```bash
git add -A
git commit -m "test: asset pipeline smoke test verified" --allow-empty
```

---

## Post-Plan Notes

- Set `REMOVE_BG_API_KEY` in `.env` to enable real background removal; otherwise uploads pass through unchanged (still usable — Figma can embed the original).
- Set `PUBLIC_BASE_URL` in `.env` when deploying so asset URLs point at the public backend.
- `storage/` is gitignored — images are runtime data, not source.
- The Figma Bridge already reads `plan.assets[name].transparent_url`, so no Bridge change is needed.
