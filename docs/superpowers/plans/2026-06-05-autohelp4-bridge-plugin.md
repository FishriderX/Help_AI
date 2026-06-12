# AutoHelp 4.0 — Figma Bridge Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Figma plugin that polls the backend for pending jobs, receives JSON Layout Plans, and renders complete game help page frames using the Figma Plugin API.

**Architecture:** The Figma Plugin API only works inside Figma (no direct HTTP from code.js). Network calls happen in `ui.html` (iframe), which polls the backend every 3 seconds. When a job is found, the iframe downloads the layout plan and all asset images, then posts everything to `code.js` via `postMessage`. `code.js` executes all Figma drawing operations. Each page type has a dedicated renderer function.

**Tech Stack:** Figma Plugin API (vanilla JS), no bundler, no dependencies

---

## File Map

```
AutoHelp4.0/figma-bridge/
├── manifest.json          # Plugin declaration + network access
├── code.js                # Figma Plugin API — drawing engine
└── ui.html                # Polling + asset fetching (runs in iframe)
```

---

## Task 1: Plugin Scaffold + Manifest

**Files:**
- Create: `figma-bridge/manifest.json`
- Create: `figma-bridge/ui.html` (polling skeleton)
- Create: `figma-bridge/code.js` (message handler skeleton)

- [ ] **Step 1: Create the project directory**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0"
mkdir figma-bridge
```

- [ ] **Step 2: Create manifest.json**

Create `figma-bridge/manifest.json`:
```json
{
  "name": "AutoHelp 4.0 Bridge",
  "id": "autohelp4-bridge",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["http://localhost:3001", "https://*.railway.app", "https://*.render.com"]
  }
}
```

- [ ] **Step 3: Create ui.html (polling skeleton)**

Create `figma-bridge/ui.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: sans-serif; padding: 16px; font-size: 13px; background: #1a1a2e; color: #e0e0e0; }
    .status { margin: 8px 0; padding: 8px; border-radius: 4px; background: #0f3460; }
    .status.error { background: #4a0e0e; }
    .status.success { background: #0e4a1e; }
    input { width: 100%; padding: 6px 8px; margin: 4px 0 8px; background: #0f3460; border: 1px solid #1a5276; border-radius: 4px; color: #fff; box-sizing: border-box; }
    label { font-size: 11px; color: #aaa; }
    button { width: 100%; padding: 8px; background: #f0c040; color: #1a1a2e; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 4px; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div style="font-size:14px;font-weight:bold;color:#f0c040;margin-bottom:12px;">AutoHelp 4.0 Bridge</div>

  <label>Backend URL</label>
  <input id="backendUrl" value="http://localhost:3001" />

  <label>API Key</label>
  <input id="apiKey" type="password" value="dev-key-12345" />

  <button id="btnConnect" onclick="togglePolling()">▶ Start Polling</button>

  <div id="statusBox" class="status">Not connected</div>

  <script>
    let polling = false;
    let pollTimer = null;

    function getConfig() {
      return {
        backendUrl: document.getElementById('backendUrl').value.trim().replace(/\/$/, ''),
        apiKey: document.getElementById('apiKey').value.trim(),
      };
    }

    function setStatus(msg, type = '') {
      const box = document.getElementById('statusBox');
      box.textContent = msg;
      box.className = 'status' + (type ? ' ' + type : '');
    }

    function togglePolling() {
      polling = !polling;
      document.getElementById('btnConnect').textContent = polling ? '⏹ Stop Polling' : '▶ Start Polling';
      if (polling) {
        setStatus('Polling for jobs...');
        pollOnce();
      } else {
        clearTimeout(pollTimer);
        setStatus('Stopped');
      }
    }

    async function pollOnce() {
      if (!polling) return;
      const { backendUrl, apiKey } = getConfig();
      try {
        const res = await fetch(`${backendUrl}/api/v1/bridge/pending`, {
          headers: { 'x-api-key': apiKey }
        });
        if (res.status === 404) {
          setStatus('No pending jobs — waiting...');
        } else if (res.ok) {
          const job = await res.json();
          setStatus(`Job found: ${job.job_id} — fetching assets...`);
          await processJob(job, backendUrl, apiKey);
        } else {
          setStatus(`Error: HTTP ${res.status}`, 'error');
        }
      } catch (e) {
        setStatus(`Connection error: ${e.message}`, 'error');
      }
      pollTimer = setTimeout(pollOnce, 3000);
    }

    async function processJob(job, backendUrl, apiKey) {
      const { plan } = job;

      // Download all asset images as base64
      const assetData = {};
      if (plan.assets) {
        for (const [name, asset] of Object.entries(plan.assets)) {
          try {
            const url = asset.transparent_url || asset.original_url;
            if (url) {
              const imgRes = await fetch(url);
              const blob = await imgRes.blob();
              const bytes = await blobToUint8Array(blob);
              assetData[name] = bytes;
            }
          } catch (e) {
            console.warn(`Failed to fetch asset ${name}:`, e.message);
          }
        }
      }

      // Send to code.js for Figma drawing
      parent.postMessage({
        pluginMessage: {
          type: 'RENDER_PLAN',
          plan,
          assetData,
          jobId: job.job_id,
          backendUrl,
          apiKey,
        }
      }, '*');
    }

    async function blobToUint8Array(blob) {
      const arrayBuffer = await blob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // Listen for messages from code.js
    window.onmessage = (event) => {
      const msg = event.data && event.data.pluginMessage;
      if (!msg) return;
      if (msg.type === 'RENDER_COMPLETE') {
        setStatus(`✅ Job ${msg.jobId} complete!`, 'success');
        // Notify backend
        const { backendUrl, apiKey } = getConfig();
        fetch(`${backendUrl}/api/v1/bridge/complete`, {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: msg.jobId, status: 'complete' })
        }).catch(() => {});
      }
      if (msg.type === 'RENDER_ERROR') {
        setStatus(`❌ Error: ${msg.error}`, 'error');
      }
    };
  </script>
</body>
</html>
```

- [ ] **Step 4: Create code.js (message handler skeleton)**

Create `figma-bridge/code.js`:
```javascript
// AutoHelp 4.0 — Figma Bridge Plugin
// Receives JSON Layout Plans from ui.html and renders Figma frames

figma.showUI(__html__, { width: 300, height: 220, title: 'AutoHelp 4.0 Bridge' });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'RENDER_PLAN') {
    try {
      await renderPlan(msg.plan, msg.assetData);
      figma.ui.postMessage({ type: 'RENDER_COMPLETE', jobId: msg.jobId });
    } catch (err) {
      figma.ui.postMessage({ type: 'RENDER_ERROR', error: err.message, jobId: msg.jobId });
    }
  }
};

async function renderPlan(plan, assetData) {
  const { meta, pages } = plan;
  const theme = THEMES[meta.theme] || THEMES.dark;

  // Load fonts
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);

  // Build image cache from assetData
  const imageCache = {};
  for (const [name, bytes] of Object.entries(assetData || {})) {
    try {
      const img = figma.createImage(bytes);
      imageCache[name] = img.hash;
    } catch (e) {
      console.warn(`Failed to create image for ${name}:`, e.message);
    }
  }

  // Create outer container
  const FRAME_W = 1920, FRAME_H = 1080;
  const FRAMES_PER_ROW = 5;
  const GAP = 40;

  const outerFrame = figma.createFrame();
  outerFrame.name = `AutoHelp_${meta.language || 'en'}_${Date.now()}`;
  outerFrame.layoutMode = 'HORIZONTAL';
  outerFrame.layoutWrap = 'WRAP';
  outerFrame.primaryAxisSizingMode = 'FIXED';
  outerFrame.counterAxisSizingMode = 'AUTO';
  outerFrame.resize(FRAMES_PER_ROW * FRAME_W + (FRAMES_PER_ROW - 1) * GAP, 100);
  outerFrame.itemSpacing = GAP;
  outerFrame.counterAxisSpacing = GAP;
  outerFrame.fills = [];
  outerFrame.clipsContent = false;

  // Render each page
  for (const page of pages) {
    const pageFrame = await renderPage(page, theme, imageCache, FRAME_W, FRAME_H);
    outerFrame.appendChild(pageFrame);
  }

  figma.currentPage.appendChild(outerFrame);
  figma.viewport.scrollAndZoomIntoView([outerFrame]);
}
```

- [ ] **Step 5: Verify the directory structure**

```
figma-bridge/
├── manifest.json
├── code.js
└── ui.html
```

- [ ] **Step 6: Initialize git and commit**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge"
git init
git add manifest.json code.js ui.html
git commit -m "feat: bridge plugin scaffold — manifest, UI polling, code.js skeleton"
```

---

## Task 2: Theme System + Shared Utilities

**Files:**
- Modify: `figma-bridge/code.js` (add THEMES, shared helpers)

- [ ] **Step 1: Add THEMES constant and shared drawing utilities to code.js**

Add the following to `figma-bridge/code.js` (append after the existing content):

```javascript
// ─── THEMES ────────────────────────────────────────────────────
const THEMES = {
  dark: {
    background: { r: 0.05, g: 0.05, b: 0.12 },
    titleGradient: [
      { position: 0, color: { r: 0.96, g: 0.60, b: 0.10, a: 1 } },
      { position: 1, color: { r: 0.94, g: 0.85, b: 0.15, a: 1 } },
    ],
    subtitleColor: { r: 0.90, g: 0.58, b: 0.08 },
    bodyText: { r: 1, g: 1, b: 1 },
    tableBorder: { r: 0.90, g: 0.58, b: 0.08 },
    tableCellFill: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.45 }],
    cornerRadius: 8,
    padding: 60,
    titleSize: 45,
    bodySize: 26,
    subtitleSize: 36,
  },
  light: {
    background: { r: 0.98, g: 0.97, b: 0.95 },
    titleGradient: [
      { position: 0, color: { r: 0.95, g: 0.40, b: 0.05, a: 1 } },
      { position: 1, color: { r: 0.99, g: 0.85, b: 0.10, a: 1 } },
    ],
    subtitleColor: { r: 0.80, g: 0.35, b: 0.05 },
    bodyText: { r: 0.10, g: 0.10, b: 0.10 },
    tableBorder: { r: 0.90, g: 0.58, b: 0.08 },
    tableCellFill: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }],
    cornerRadius: 8,
    padding: 60,
    titleSize: 45,
    bodySize: 26,
    subtitleSize: 36,
  },
};

// ─── SHARED HELPERS ─────────────────────────────────────────────

function makeText(characters, fontSize, color, opts = {}) {
  const t = figma.createText();
  t.fontName = opts.bold ? { family: 'Inter', style: 'Bold' } : { family: 'Inter', style: 'Regular' };
  t.fontSize = fontSize;
  t.characters = characters || ' ';
  t.fills = [{ type: 'SOLID', color }];
  if (opts.align) t.textAlignHorizontal = opts.align;
  if (opts.layoutAlign) t.layoutAlign = opts.layoutAlign;
  if (opts.layoutGrow !== undefined) t.layoutGrow = opts.layoutGrow;
  t.textAutoResize = opts.autoResize || 'HEIGHT';
  return t;
}

function makeGradientText(characters, fontSize, gradientStops, opts = {}) {
  const t = figma.createText();
  t.fontName = opts.bold ? { family: 'Inter', style: 'Bold' } : { family: 'Inter', style: 'Regular' };
  t.fontSize = fontSize;
  t.characters = characters || ' ';
  t.fills = [{
    type: 'GRADIENT_LINEAR',
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
    gradientStops,
  }];
  if (opts.align) t.textAlignHorizontal = opts.align;
  if (opts.layoutAlign) t.layoutAlign = opts.layoutAlign;
  t.textAutoResize = 'HEIGHT';
  return t;
}

function makeFrame(opts = {}) {
  const f = figma.createFrame();
  f.fills = opts.fills || [];
  f.layoutMode = opts.direction || 'VERTICAL';
  f.primaryAxisSizingMode = opts.primarySize || 'AUTO';
  f.counterAxisSizingMode = opts.counterSize || 'AUTO';
  if (opts.primaryAlign) f.primaryAxisAlignItems = opts.primaryAlign;
  if (opts.counterAlign) f.counterAxisAlignItems = opts.counterAlign;
  if (opts.spacing !== undefined) f.itemSpacing = opts.spacing;
  if (opts.layoutAlign) f.layoutAlign = opts.layoutAlign;
  if (opts.layoutGrow !== undefined) f.layoutGrow = opts.layoutGrow;
  if (opts.padding !== undefined) {
    f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = opts.padding;
  }
  if (opts.cornerRadius) f.cornerRadius = opts.cornerRadius;
  if (opts.clipsContent !== undefined) f.clipsContent = opts.clipsContent;
  if (opts.name) f.name = opts.name;
  return f;
}

function makeHSep(theme) {
  const s = figma.createFrame();
  s.resize(1, 1);
  s.layoutAlign = 'STRETCH';
  s.fills = [{ type: 'SOLID', color: theme.tableBorder }];
  return s;
}

function makeVSep(theme) {
  const s = figma.createFrame();
  s.resize(1, 1);
  s.layoutAlign = 'STRETCH';
  s.fills = [{ type: 'SOLID', color: theme.tableBorder }];
  return s;
}

function makeTblCell(width, text, theme, fontSize = 18) {
  const cell = makeFrame({
    fills: theme.tableCellFill,
    primarySize: 'AUTO',
    counterSize: 'FIXED',
    primaryAlign: 'CENTER',
    counterAlign: 'CENTER',
    padding: 10,
    name: 'TBL_CELL',
  });
  cell.resize(width, 1);
  cell.clipsContent = false;
  const t = makeText(text || ' ', fontSize, theme.bodyText, { layoutAlign: 'STRETCH', align: 'CENTER' });
  cell.appendChild(t);
  return cell;
}

function makeTblCellGrow(text, theme, fontSize = 18) {
  const cell = makeFrame({
    fills: theme.tableCellFill,
    primarySize: 'AUTO',
    counterSize: 'AUTO',
    primaryAlign: 'CENTER',
    counterAlign: 'CENTER',
    padding: 10,
    name: 'TBL_CELL',
  });
  cell.layoutGrow = 1;
  cell.layoutAlign = 'STRETCH';
  cell.clipsContent = false;
  const t = makeText(text || ' ', fontSize, theme.bodyText, { layoutAlign: 'STRETCH', align: 'CENTER' });
  cell.appendChild(t);
  return cell;
}

function makeTblContainer(contentWidth, theme) {
  const tf = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'FIXED', spacing: 0 });
  tf.resize(contentWidth, 1);
  tf.fills = [];
  tf.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
  tf.strokeWeight = 2;
  tf.strokeAlign = 'OUTSIDE';
  tf.cornerRadius = theme.cornerRadius;
  return tf;
}

function makeTblRow(contentWidth) {
  const row = makeFrame({ direction: 'HORIZONTAL', primarySize: 'FIXED', counterSize: 'AUTO', spacing: 0 });
  row.resize(contentWidth, 1);
  row.fills = [];
  row.clipsContent = false;
  return row;
}

function makeIconFrame(assetName, size, imageCache, theme) {
  const f = makeFrame({ primarySize: 'FIXED', counterSize: 'FIXED', name: 'TBL_CELL' });
  f.resize(size, size);
  if (imageCache[assetName]) {
    f.fills = [{ type: 'IMAGE', imageHash: imageCache[assetName], scaleMode: 'FIT' }];
  } else {
    f.fills = [{ type: 'SOLID', color: { r: 0.30, g: 0.28, b: 0.38 } }];
    f.cornerRadius = 6;
    const t = makeText(assetName || '?', Math.max(10, Math.floor(size * 0.2)), { r: 0.8, g: 0.78, b: 0.9 }, { align: 'CENTER' });
    f.appendChild(t);
  }
  return f;
}

// ─── PAGE FRAME WRAPPER ─────────────────────────────────────────

function makePageFrame(pageId, theme, frameW, frameH) {
  const pageFrame = figma.createFrame();
  pageFrame.name = pageId;
  pageFrame.resize(frameW, frameH);
  pageFrame.fills = [{ type: 'SOLID', color: theme.background }];
  pageFrame.cornerRadius = theme.cornerRadius;
  pageFrame.clipsContent = true;
  return pageFrame;
}

function makeContentFrame(theme, frameW, frameH) {
  const PADDING = theme.padding;
  const cf = makeFrame({
    direction: 'VERTICAL',
    primarySize: 'FIXED',
    counterSize: 'FIXED',
    spacing: 32,
  });
  cf.name = 'content';
  cf.fills = [];
  cf.clipsContent = false;
  cf.resize(frameW - PADDING * 2, frameH - PADDING * 2);
  cf.x = PADDING;
  cf.y = PADDING;
  return cf;
}

// ─── ROUTER ─────────────────────────────────────────────────────

async function renderPage(page, theme, imageCache, frameW, frameH) {
  const pageFrame = makePageFrame(page.id, theme, frameW, frameH);
  const contentFrame = makeContentFrame(theme, frameW, frameH);
  pageFrame.appendChild(contentFrame);

  switch (page.type) {
    case 'feature_text':
    case 'fortune_chance':
    case 'instant_bonus':
      renderFeatureText(page, theme, contentFrame);
      break;
    case 'paytable':
      renderPaytable(page, theme, imageCache, contentFrame, frameW);
      break;
    case 'symbols_per_play':
      renderSymbolsPerPlay(page, theme, imageCache, contentFrame, frameW);
      break;
    case 'prizes_table':
      renderPrizesTable(page, theme, contentFrame, frameW);
      break;
    case 'jackpot':
      renderJackpot(page, theme, contentFrame, frameW);
      break;
    case 'setting_info':
      renderSettingInfo(page, theme, contentFrame, frameW);
      break;
    case 'multi_section':
      renderMultiSection(page, theme, imageCache, contentFrame, frameW);
      break;
    case 'special_feature':
      renderSpecialFeature(page, theme, contentFrame, frameW);
      break;
    case 'combo_feature':
      renderComboFeature(page, theme, contentFrame, frameW);
      break;
    case 'game_settings':
      renderGameSettings(page, theme, contentFrame, frameW);
      break;
    case 'spin_button':
      renderSpinButton(page, theme, imageCache, contentFrame, frameW);
      break;
    default:
      renderCustom(page, theme, contentFrame);
  }

  return pageFrame;
}
```

- [ ] **Step 2: Verify code.js is valid JS (no syntax errors)**

```bash
node --check "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge\code.js"
```
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge"
git add code.js
git commit -m "feat: theme system + shared drawing utilities + page router"
```

---

## Task 3: Core Renderers — feature_text, paytable, multi_section

**Files:**
- Modify: `figma-bridge/code.js` (add renderer functions)

These 3 types cover the majority of real game help pages.

- [ ] **Step 1: Add renderer functions to code.js**

Append the following to `figma-bridge/code.js`:

```javascript
// ─── RENDERER: feature_text / fortune_chance / instant_bonus ────

function renderFeatureText(page, theme, contentFrame) {
  const title = makeGradientText(
    page.title, theme.titleSize, theme.titleGradient,
    { align: 'CENTER', layoutAlign: 'STRETCH' }
  );
  contentFrame.appendChild(title);

  const body = Array.isArray(page.body) ? page.body : [page.body || ''];
  const bodyText = body.join('\n');
  const ruleNode = makeText(bodyText, theme.bodySize, theme.bodyText, {
    layoutAlign: 'STRETCH', layoutGrow: 1, align: 'LEFT',
  });
  ruleNode.textAutoResize = 'NONE';
  contentFrame.appendChild(ruleNode);
}

// ─── RENDERER: paytable ─────────────────────────────────────────

function renderPaytable(page, theme, imageCache, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  // Title
  const title = makeGradientText(
    page.title, theme.titleSize, theme.titleGradient,
    { align: 'CENTER', layoutAlign: 'STRETCH' }
  );
  contentFrame.appendChild(title);

  // Rules
  if (page.rules && page.rules.length) {
    const rulesText = page.rules.join('\n');
    const rulesNode = makeText(rulesText, theme.bodySize - 4, theme.bodyText, {
      layoutAlign: 'STRETCH', align: 'LEFT',
    });
    contentFrame.appendChild(rulesNode);
  }

  // Symbol cards
  if (!page.symbols || !page.symbols.length) return;
  const GAP = 16;
  const ICON_SIZE = 80;
  const n = Math.min(page.symbols.length, 5);
  const cardW = Math.floor((contentW - GAP * (n - 1)) / n);

  const cardsRow = makeFrame({
    direction: 'HORIZONTAL',
    primarySize: 'AUTO',
    counterSize: 'AUTO',
    spacing: GAP,
    layoutAlign: 'STRETCH',
  });
  cardsRow.layoutWrap = 'WRAP';
  cardsRow.counterAxisSpacing = GAP;

  for (const sym of page.symbols) {
    const card = makeFrame({
      direction: 'VERTICAL',
      primarySize: 'AUTO',
      counterSize: 'FIXED',
      primaryAlign: 'CENTER',
      counterAlign: 'CENTER',
      spacing: 8,
      padding: 12,
      cornerRadius: 8,
    });
    card.resize(cardW, 1);
    card.fills = [{ type: 'SOLID', color: { r: 0.18, g: 0.15, b: 0.28 } }];
    card.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
    card.strokeWeight = 1;
    card.strokeAlign = 'INSIDE';

    // Icon
    const icon = makeIconFrame(sym.asset, ICON_SIZE, imageCache, theme);
    card.appendChild(icon);

    // Divider
    const div = figma.createFrame();
    div.resize(cardW - 24, 1);
    div.fills = [{ type: 'SOLID', color: theme.tableBorder }];
    div.layoutAlign = 'STRETCH';
    card.appendChild(div);

    // Payouts
    if (sym.payouts && sym.payouts.length) {
      const payLines = sym.payouts.map(p => `${p.range || p.count}  →  ${p.value}`).join('\n');
      const payText = makeText(payLines, 17, theme.bodyText, { align: 'CENTER', layoutAlign: 'STRETCH' });
      card.appendChild(payText);
    }

    cardsRow.appendChild(card);
  }
  contentFrame.appendChild(cardsRow);
}

// ─── RENDERER: multi_section ────────────────────────────────────

function renderMultiSection(page, theme, imageCache, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  // Main title
  const title = makeGradientText(
    page.title, theme.titleSize, theme.titleGradient,
    { align: 'CENTER', layoutAlign: 'STRETCH' }
  );
  contentFrame.appendChild(title);

  // Main body
  if (page.body && page.body.length) {
    const bodyText = Array.isArray(page.body) ? page.body.join('\n') : page.body;
    const bodyNode = makeText(bodyText, theme.bodySize, theme.bodyText, {
      layoutAlign: 'STRETCH', align: 'LEFT',
    });
    contentFrame.appendChild(bodyNode);
  }

  // Sub-sections
  if (page.sections && page.sections.length) {
    for (const sec of page.sections) {
      // Sub-title
      const subTitle = makeText(
        sec.subtitle, theme.subtitleSize, theme.subtitleColor,
        { align: 'CENTER', layoutAlign: 'STRETCH', bold: true }
      );
      contentFrame.appendChild(subTitle);

      // Sub-body
      if (sec.body && sec.body.length) {
        const subBody = Array.isArray(sec.body) ? sec.body.join('\n') : sec.body;
        const subBodyNode = makeText(subBody, theme.bodySize, theme.bodyText, {
          layoutAlign: 'STRETCH', align: 'LEFT',
        });
        contentFrame.appendChild(subBodyNode);
      }
    }
  }

  // Optional table (value grid)
  if (page.table && page.table.values && page.table.values.length) {
    const tbl = buildValueGrid(page.table.values, theme, contentW);
    tbl.layoutAlign = 'STRETCH';
    contentFrame.appendChild(tbl);
  }
}

function buildValueGrid(values, theme, contentW) {
  const COLS = 5;
  const GAP = 8;
  const cellW = Math.floor((contentW - GAP * (COLS - 1)) / COLS);
  const grid = makeFrame({
    direction: 'HORIZONTAL',
    primarySize: 'AUTO',
    counterSize: 'AUTO',
    spacing: GAP,
  });
  grid.layoutWrap = 'WRAP';
  grid.counterAxisSpacing = GAP;
  grid.fills = [{ type: 'SOLID', color: { r: 0.10, g: 0.08, b: 0.18 } }];
  grid.paddingTop = grid.paddingBottom = grid.paddingLeft = grid.paddingRight = GAP;
  grid.cornerRadius = 8;

  for (const val of values) {
    const cell = makeFrame({
      direction: 'VERTICAL',
      primarySize: 'FIXED',
      counterSize: 'FIXED',
      primaryAlign: 'CENTER',
      counterAlign: 'CENTER',
    });
    cell.resize(cellW, 40);
    cell.fills = theme.tableCellFill;
    cell.cornerRadius = 4;
    const t = makeText(String(val), 18, theme.bodyText, { align: 'CENTER' });
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
    cell.appendChild(t);
    grid.appendChild(cell);
  }
  return grid;
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge\code.js"
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge"
git add code.js
git commit -m "feat: renderers — feature_text, paytable, multi_section"
```

---

## Task 4: Table Renderers — jackpot, symbols_per_play, prizes_table, setting_info

**Files:**
- Modify: `figma-bridge/code.js`

- [ ] **Step 1: Append table renderer functions**

```javascript
// ─── RENDERER: jackpot ──────────────────────────────────────────

function renderJackpot(page, theme, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.rules && page.rules.length) {
    const rulesNode = makeText(page.rules.join('\n'), theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' });
    contentFrame.appendChild(rulesNode);
  }

  // Jackpot tier labels
  if (page.jackpotTiers && page.jackpotTiers.length) {
    const tierColors = { GRAND: {r:0.95,g:0.15,b:0.15}, MAJOR: {r:0.55,g:0.10,b:0.80}, MINOR: {r:0.20,g:0.60,b:0.95}, MINI: {r:0.20,g:0.75,b:0.30} };
    const tierRow = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 16, layoutAlign: 'STRETCH' });
    tierRow.fills = [];
    for (const tier of page.jackpotTiers) {
      const upperTier = tier.toUpperCase();
      const color = tierColors[upperTier] || theme.subtitleColor;
      const t = makeText(tier, theme.subtitleSize - 4, color, { align: 'CENTER', bold: true });
      tierRow.appendChild(t);
    }
    contentFrame.appendChild(tierRow);
  }

  // Denomination table (empty cells — dynamic)
  const tf = makeTblContainer(contentW, theme);
  const BET_W = 160;
  const DENOM_COLS = 5;
  const denomColW = Math.floor((contentW - BET_W) / DENOM_COLS);

  // Header row
  const headerRow = makeTblRow(contentW);
  headerRow.appendChild(makeTblCell(BET_W, '', theme));
  headerRow.appendChild(makeVSep(theme));
  headerRow.appendChild(makeTblCellGrow('DENOMINATION', theme, 20));
  tf.appendChild(headerRow);

  // Data rows for each jackpot tier
  const tiers = page.jackpotTiers || ['MINI', 'MINOR'];
  for (const tier of tiers) {
    tf.appendChild(makeHSep(theme));
    const row = makeTblRow(contentW);
    const tierColors = { GRAND: {r:0.95,g:0.15,b:0.15}, MAJOR: {r:0.55,g:0.10,b:0.80}, MINOR: {r:0.20,g:0.60,b:0.95}, MINI: {r:0.20,g:0.75,b:0.30} };
    const cell = makeTblCell(BET_W, tier, theme);
    cell.children[0].fills = [{ type: 'SOLID', color: tierColors[tier.toUpperCase()] || theme.subtitleColor }];
    row.appendChild(cell);
    row.appendChild(makeVSep(theme));
    for (let i = 0; i < DENOM_COLS; i++) {
      if (i > 0) row.appendChild(makeVSep(theme));
      row.appendChild(i < DENOM_COLS - 1 ? makeTblCell(denomColW, '', theme) : makeTblCellGrow('', theme));
    }
    tf.appendChild(row);
  }

  tf.layoutAlign = 'STRETCH';
  contentFrame.appendChild(tf);
}

// ─── RENDERER: symbols_per_play ─────────────────────────────────

function renderSymbolsPerPlay(page, theme, imageCache, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;
  const BET_W = 130;
  const ICON_SIZE = 56;

  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.note) {
    contentFrame.appendChild(makeText(page.note, theme.bodySize - 4, theme.bodyText, { layoutAlign: 'STRETCH' }));
  }

  const tf = makeTblContainer(contentW, theme);

  // Header
  const header = makeTblRow(contentW);
  header.appendChild(makeTblCell(BET_W, 'BET', theme, 20));
  header.appendChild(makeVSep(theme));
  header.appendChild(makeTblCellGrow('SYMBOLS', theme, 20));
  tf.appendChild(header);

  for (const bet of (page.bets || [])) {
    tf.appendChild(makeHSep(theme));
    const row = makeTblRow(contentW);
    row.appendChild(makeTblCell(BET_W, String(bet.amount || ''), theme, 22));
    row.appendChild(makeVSep(theme));

    const symCell = makeFrame({
      direction: 'VERTICAL',
      primarySize: 'AUTO',
      counterSize: 'AUTO',
      primaryAlign: 'CENTER',
      counterAlign: 'MIN',
      padding: 10,
      name: 'TBL_CELL',
    });
    symCell.layoutGrow = 1;
    symCell.layoutAlign = 'STRETCH';
    symCell.fills = theme.tableCellFill;

    const iconRow = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 8, layoutAlign: 'STRETCH' });
    iconRow.layoutWrap = 'WRAP';
    iconRow.counterAxisSpacing = 8;
    iconRow.fills = [];

    for (const sym of (bet.activeSymbols || [])) {
      iconRow.appendChild(makeIconFrame(sym, ICON_SIZE, imageCache, theme));
    }
    // X marks for removed symbols
    for (const sym of (bet.removedSymbols || [])) {
      const xf = makeFrame({ primarySize: 'FIXED', counterSize: 'FIXED', primaryAlign: 'CENTER', counterAlign: 'CENTER', name: 'TBL_CELL' });
      xf.resize(ICON_SIZE, ICON_SIZE);
      xf.fills = [{ type: 'SOLID', color: { r: 0.65, g: 0.12, b: 0.08 } }];
      xf.cornerRadius = 4;
      const xt = makeText('✕', Math.floor(ICON_SIZE * 0.55), { r: 1, g: 1, b: 1 }, { align: 'CENTER' });
      xt.textAutoResize = 'WIDTH_AND_HEIGHT';
      xf.appendChild(xt);
      iconRow.appendChild(xf);
    }
    symCell.appendChild(iconRow);
    row.appendChild(symCell);
    tf.appendChild(row);
  }

  tf.layoutAlign = 'STRETCH';
  contentFrame.appendChild(tf);
}

// ─── RENDERER: prizes_table ─────────────────────────────────────

function renderPrizesTable(page, theme, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.note) {
    contentFrame.appendChild(makeText(page.note, theme.bodySize - 4, theme.bodyText, { layoutAlign: 'STRETCH' }));
  }

  const rows = page.rows || [];
  const MAX_PER_COL = 14;
  const BET_W = 120;

  function buildSingleTable(rowSlice, width) {
    const tf = makeTblContainer(width, theme);
    for (let i = 0; i < rowSlice.length; i++) {
      if (i > 0) tf.appendChild(makeHSep(theme));
      const r = rowSlice[i];
      const row = makeTblRow(width);
      row.appendChild(makeTblCell(BET_W, `BET ${r.bet || ''}`, theme));
      row.appendChild(makeVSep(theme));
      row.appendChild(makeTblCellGrow(`${r.min || ''} ~ ${r.max || ''}`, theme));
      tf.appendChild(row);
    }
    return tf;
  }

  if (rows.length > MAX_PER_COL) {
    const mid = Math.ceil(rows.length / 2);
    const colW = Math.floor((contentW - 24) / 2);
    const container = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 24, layoutAlign: 'STRETCH' });
    container.fills = [];
    container.appendChild(buildSingleTable(rows.slice(0, mid), colW));
    container.appendChild(buildSingleTable(rows.slice(mid), colW));
    contentFrame.appendChild(container);
  } else {
    const tf = buildSingleTable(rows, contentW);
    tf.layoutAlign = 'STRETCH';
    contentFrame.appendChild(tf);
  }
}

// ─── RENDERER: setting_info ─────────────────────────────────────

function renderSettingInfo(page, theme, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;
  const BET_W = 200;

  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  // Main table (WAYS, TOTAL BET, etc.)
  const tf = makeTblContainer(contentW, theme);
  // Header
  const header = makeTblRow(contentW);
  header.appendChild(makeTblCell(BET_W, '', theme));
  header.appendChild(makeVSep(theme));
  header.appendChild(makeTblCell(Math.floor((contentW - BET_W) / 2), 'MINIMUM', theme, 20));
  header.appendChild(makeVSep(theme));
  header.appendChild(makeTblCellGrow('MAXIMUM', theme, 20));
  tf.appendChild(header);

  for (const row of (page.rows || [])) {
    tf.appendChild(makeHSep(theme));
    const r = makeTblRow(contentW);
    r.appendChild(makeTblCell(BET_W, row.label || '', theme));
    r.appendChild(makeVSep(theme));
    r.appendChild(makeTblCell(Math.floor((contentW - BET_W) / 2), row.min || '', theme));
    r.appendChild(makeVSep(theme));
    r.appendChild(makeTblCellGrow(row.max || '', theme));
    tf.appendChild(r);
  }

  tf.layoutAlign = 'STRETCH';
  contentFrame.appendChild(tf);

  // Denomination sections
  for (const sec of (page.denominationSections || [])) {
    const secFrame = makeFrame({
      direction: 'VERTICAL',
      primarySize: 'AUTO',
      counterSize: 'FIXED',
      primaryAlign: 'CENTER',
      counterAlign: 'CENTER',
      padding: 16,
      layoutAlign: 'STRETCH',
    });
    secFrame.fills = theme.tableCellFill;
    secFrame.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
    secFrame.strokeWeight = 1;
    secFrame.strokeAlign = 'INSIDE';
    secFrame.cornerRadius = 6;
    if (sec.body) {
      const bodyText = Array.isArray(sec.body) ? sec.body.join('\n') : sec.body;
      secFrame.appendChild(makeText(bodyText, theme.bodySize - 4, theme.bodyText, { layoutAlign: 'STRETCH', align: 'CENTER' }));
    }
    contentFrame.appendChild(secFrame);
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge\code.js"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge"
git add code.js
git commit -m "feat: renderers — jackpot, symbols_per_play, prizes_table, setting_info"
```

---

## Task 5: Remaining Renderers + Backend Bridge Endpoint

**Files:**
- Modify: `figma-bridge/code.js` (remaining renderers)
- Modify: `backend/src/routes/generate.js` (add bridge polling endpoint)
- Create: `backend/src/routes/bridge.js`
- Modify: `backend/src/index.js` (mount bridge route)

- [ ] **Step 1: Append remaining renderers to code.js**

```javascript
// ─── RENDERER: special_feature ──────────────────────────────────

function renderSpecialFeature(page, theme, contentFrame, frameW) {
  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.note) {
    contentFrame.appendChild(makeText(page.note, theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' }));
  }

  for (const sec of (page.sections || [])) {
    const subTitle = makeText(sec.subtitle, theme.subtitleSize, theme.subtitleColor, { bold: true, layoutAlign: 'STRETCH' });
    contentFrame.appendChild(subTitle);
    if (sec.body && sec.body.length) {
      const bodyText = Array.isArray(sec.body) ? sec.body.join('\n') : sec.body;
      contentFrame.appendChild(makeText(bodyText, theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' }));
    }
  }
}

// ─── RENDERER: combo_feature ────────────────────────────────────

function renderComboFeature(page, theme, contentFrame, frameW) {
  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.triggerRules && page.triggerRules.length) {
    contentFrame.appendChild(makeText(page.triggerRules.join('\n'), theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' }));
  }

  for (const effect of (page.effects || [])) {
    const subTitle = makeText(effect.name, theme.subtitleSize, theme.subtitleColor, { align: 'CENTER', bold: true, layoutAlign: 'STRETCH' });
    contentFrame.appendChild(subTitle);
    if (effect.rules && effect.rules.length) {
      contentFrame.appendChild(makeText(effect.rules.join('\n'), theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' }));
    }
  }
}

// ─── RENDERER: game_settings ────────────────────────────────────

function renderGameSettings(page, theme, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  // Board grid placeholder
  const boardH = Math.floor((contentW * 9) / 16 * 0.5);
  const board = makeFrame({ primarySize: 'FIXED', counterSize: 'FIXED', layoutAlign: 'STRETCH', name: 'board_grid' });
  board.resize(contentW, boardH);
  board.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.12, b: 0.22 } }];
  board.cornerRadius = 8;
  contentFrame.appendChild(board);

  const info = page.boardInfo || {};
  const infoLines = [
    info.reels ? `THE GAME IS PLAYED ON A BOARD OF ${info.reels} REELS, EACH WITH A HEIGHT OF ${info.height || '?'}.` : '',
    info.clusterMin ? `WINS ARE EVALUATED USING THE CLUSTER PAY MODEL: GROUPS OF ${info.clusterMin} OR MORE IDENTICAL SYMBOLS, AND ${info.scatterMin || '4'} OR MORE [SCATTER].` : '',
  ].filter(Boolean);

  if (infoLines.length) {
    contentFrame.appendChild(makeText(infoLines.join('\n'), theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' }));
  }

  if (page.copyright) {
    const copyrightText = makeText(page.copyright, 14, { r: 0.7, g: 0.7, b: 0.7 }, { align: 'CENTER', layoutAlign: 'STRETCH' });
    contentFrame.appendChild(copyrightText);
  }
}

// ─── RENDERER: spin_button ──────────────────────────────────────

function renderSpinButton(page, theme, imageCache, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;
  const ICON_SIZE = 120;

  const card = makeFrame({
    direction: 'HORIZONTAL',
    primarySize: 'AUTO',
    counterSize: 'FIXED',
    primaryAlign: 'MIN',
    counterAlign: 'CENTER',
    spacing: 32,
    padding: 32,
    cornerRadius: 12,
    layoutAlign: 'STRETCH',
  });
  card.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.13, b: 0.25 } }];

  const icon = makeIconFrame(page.icon, ICON_SIZE, imageCache, theme);
  card.appendChild(icon);

  const textCol = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 8 });
  textCol.layoutGrow = 1;
  textCol.layoutAlign = 'STRETCH';
  textCol.fills = [];

  const titleNode = makeText(page.title, theme.subtitleSize, theme.subtitleColor, { bold: true, layoutAlign: 'STRETCH' });
  textCol.appendChild(titleNode);

  const bodyText = typeof page.body === 'string' ? page.body : (page.body || []).join('\n');
  if (bodyText) {
    textCol.appendChild(makeText(bodyText, theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH' }));
  }

  card.appendChild(textCol);
  contentFrame.appendChild(card);
}

// ─── RENDERER: custom (fallback) ────────────────────────────────

function renderCustom(page, theme, contentFrame) {
  const title = makeGradientText(page.title || 'Custom Page', theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  const content = typeof page.content === 'string' ? page.content : JSON.stringify(page.content || '', null, 2);
  contentFrame.appendChild(makeText(content, theme.bodySize, theme.bodyText, { layoutAlign: 'STRETCH', layoutGrow: 1 }));
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge\code.js"
```

- [ ] **Step 3: Add bridge polling endpoint to backend**

Create `backend/src/routes/bridge.js`:
```javascript
import { Router } from 'express';
import { getJob, updateJob, JOB_STATES } from '../services/jobManager.js';

export const bridgeRoute = Router();

// Figma Bridge Plugin polls this to get pending jobs
bridgeRoute.get('/pending', (req, res) => {
  // Find the oldest PENDING_FIGMA job
  // NOTE: In production, use a proper queue. For Phase 1, scan the Map.
  const { jobs } = getJobsInternal();
  const pending = jobs.find(j => j.status === JOB_STATES.PENDING_FIGMA);
  if (!pending) return res.status(404).json({ message: 'No pending jobs' });

  // Mark as rendering so it's not picked up twice
  updateJob(pending.id, JOB_STATES.RENDERING);
  res.json({ job_id: pending.id, plan: pending.result.layoutPlan });
});

// Figma Bridge Plugin reports completion
bridgeRoute.post('/complete', (req, res) => {
  const { job_id, status } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  try {
    updateJob(job_id, status === 'complete' ? JOB_STATES.COMPLETE : JOB_STATES.FAILED);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Export jobs from jobManager for bridge route**

Read `backend/src/services/jobManager.js`. Add this export at the bottom:
```javascript
// Internal: allows bridge route to scan jobs
export function getJobsInternal() {
  return { jobs: Array.from(jobs.values()) };
}
```

- [ ] **Step 5: Mount bridge route in index.js**

Read `backend/src/index.js`. Add the bridge route import and mount:

After `import { jobsRoute } from './routes/jobs.js';` add:
```javascript
import { bridgeRoute } from './routes/bridge.js';
```

After `app.use('/api/v1/jobs', jobsRoute);` add:
```javascript
app.use('/api/v1/bridge', bridgeRoute);
```

- [ ] **Step 6: Verify syntax on all changed files**

```bash
node --check "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge\code.js"
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
npm test
```
Expected: All existing 20 tests still pass.

- [ ] **Step 7: Commit both changes**

```bash
# Bridge plugin
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\figma-bridge"
git add code.js
git commit -m "feat: renderers — special_feature, combo_feature, game_settings, spin_button, custom"

# Backend
cd "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0\backend"
git add src/routes/bridge.js src/services/jobManager.js src/index.js
git commit -m "feat: bridge polling endpoint — GET /bridge/pending + POST /bridge/complete"
```

---

## Post-Plan Notes

- The Figma plugin must be loaded in Figma from `figma-bridge/manifest.json`
- To test end-to-end: set real `ANTHROPIC_API_KEY` in `backend/.env`, start backend (`npm start`), open Figma, load plugin, press "Start Polling", then submit a job via the API or web app
- Asset URLs in the layout plan need to be accessible from Figma's context (use public URLs or localhost when testing)
- For cloud deployment: update `manifest.json` `allowedDomains` to include the deployed backend URL
