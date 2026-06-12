// AutoHelp 4.0 — Figma Bridge Plugin
// Receives JSON Layout Plans from ui.html and renders Figma frames

figma.showUI(__html__, { width: 300, height: 220, title: 'AutoHelp 4.0 Bridge' });

// Image cache for the plan currently being rendered (set in renderPlan).
// Module-level so inline rich-text rendering can reach it from any renderer.
let g_imageCache = {};

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

// A loose node at the page root that came from our renderer (a fragment left
// behind by a previously-failed render). Finished generations are AutoHelp_*.
function isOrphanArtifact(node) {
  const n = node.name || '';
  if (n.indexOf('AutoHelp_') === 0) return false; // a finished generation — keep
  if (node.type === 'TEXT') return true;          // loose text = leftover
  if (n === 'TBL_CELL' || n === 'content' || n === 'board_grid') return true;
  if (/^PAGE_\d+$/.test(n) || /^icon_/.test(n) || /^line\d+$/.test(n)) return true;
  // An unnamed "Frame" fragment that directly contains our artifacts.
  if (node.type === 'FRAME' && 'children' in node) {
    for (const ch of node.children) {
      const cn = ch.name || '';
      if (cn === 'TBL_CELL' || cn === 'content' || /^PAGE_\d+$/.test(cn)) return true;
    }
  }
  return false;
}

function cleanupOrphans() {
  for (const node of figma.currentPage.children.slice()) {
    try { if (isOrphanArtifact(node)) node.remove(); } catch (e) { /* ignore */ }
  }
}

async function renderPlan(plan, assetData) {
  const { meta, pages } = plan;
  const theme = THEMES[meta.theme] || THEMES.dark;

  // Sweep away orphaned fragments from any earlier failed render first.
  cleanupOrphans();

  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);

  const imageCache = {};
  for (const [name, bytes] of Object.entries(assetData || {})) {
    try {
      const img = figma.createImage(bytes);
      imageCache[name] = img.hash;
    } catch (e) {
      console.warn(`Failed to create image for ${name}:`, e.message);
    }
  }
  g_imageCache = imageCache;

  const FRAME_W = 1920, FRAME_H = 1080;
  const FRAMES_PER_ROW = 5;
  const GAP = 40;

  const outerFrame = figma.createFrame();
  outerFrame.name = `AutoHelp_${meta.language || 'en'}_${Date.now()}`;
  outerFrame.layoutMode = 'HORIZONTAL';
  outerFrame.layoutWrap = 'WRAP';
  outerFrame.resize(FRAMES_PER_ROW * FRAME_W + (FRAMES_PER_ROW - 1) * GAP, 100);
  outerFrame.primaryAxisSizingMode = 'FIXED';
  outerFrame.counterAxisSizingMode = 'AUTO';
  outerFrame.itemSpacing = GAP;
  outerFrame.counterAxisSpacing = GAP;
  outerFrame.fills = [];
  outerFrame.clipsContent = false;

  for (const page of pages) {
    try {
      const pageFrame = await renderPage(page, theme, imageCache, FRAME_W, FRAME_H);
      outerFrame.appendChild(pageFrame);
    } catch (e) {
      // One bad page must not crash the whole render or orphan everything.
      console.warn(`Page ${page && page.id} failed to render:`, e.message);
    }
  }
  // Remove any fragments a failed page may have left loose on the canvas.
  cleanupOrphans();

  // Place this generation BELOW any existing content so repeated renders never
  // overlap (otherwise every job stacks at the same spot and looks jumbled).
  let maxBottom = 0;
  for (const child of figma.currentPage.children) {
    if (child === outerFrame) continue; // don't measure ourselves
    maxBottom = Math.max(maxBottom, child.y + child.height);
  }
  figma.currentPage.appendChild(outerFrame);
  outerFrame.x = 0;
  outerFrame.y = maxBottom > 0 ? maxBottom + 200 : 0;
  figma.viewport.scrollAndZoomIntoView([outerFrame]);
}

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
    highlight: { r: 1, g: 0.85, b: 0 },
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
    highlight: { r: 0.85, g: 0.55, b: 0 },
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

// ─── INLINE RICH TEXT (ported from AutoHelp 3.0) ────────────────
// [Name] -> inline symbol image (from the uploaded assets); {text} -> highlight
// colour with the braces stripped; everything else wraps naturally.

function isCJK(code) {
  return (code >= 0x4E00 && code <= 0x9FFF)
      || (code >= 0x3400 && code <= 0x4DBF)
      || (code >= 0xF900 && code <= 0xFAFF)
      || (code >= 0x3000 && code <= 0x303F)
      || (code >= 0xFF01 && code <= 0xFF60)
      || (code >= 0x30A0 && code <= 0x30FF)
      || (code >= 0x3040 && code <= 0x309F);
}

function tokenizeText(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const code = text.codePointAt(i);
    const chLen = code > 0xFFFF ? 2 : 1;
    if (isCJK(code)) {
      tokens.push(text.slice(i, i + chLen));
      i += chLen;
    } else {
      const start = i;
      while (i < text.length && !isCJK(text.codePointAt(i))) i++;
      const run = text.slice(start, i);
      const words = run.match(/\S+\s*|\s+/g);
      if (words) tokens.push(...words);
      else if (run) tokens.push(run);
    }
  }
  return tokens.filter((t) => t.length > 0);
}

// Inline symbol image sized to the text. Returns null when no uploaded image
// matches this name (caller then keeps the literal [Name] text).
function makeInlineIcon(name, size) {
  if (!g_imageCache[name]) return null;
  const f = figma.createFrame();
  f.resize(size, size);
  f.fills = [{ type: 'IMAGE', imageHash: g_imageCache[name], scaleMode: 'FIT' }];
  f.name = 'icon_' + name;
  return f;
}

// True if the line has a [tag] we actually have an uploaded image for.
function hasInlineIcon(text) {
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (g_imageCache[m[1]]) return true;
  }
  return false;
}

// Single text node for a line: strip {} braces and colour those ranges.
// Keeps native text wrapping (used when the line has no inline icons).
function makeHighlightedLine(lineText, theme, fontSize, color) {
  let out = '';
  const ranges = [];
  const re = /(\{[^}]+\}|[^{}]+)/g;
  let m;
  while ((m = re.exec(lineText)) !== null) {
    const seg = m[0];
    if (seg.charAt(0) === '{' && seg.charAt(seg.length - 1) === '}') {
      const inner = seg.slice(1, -1);
      const start = out.length;
      out += inner;
      ranges.push({ start, end: out.length });
    } else {
      out += seg;
    }
  }
  const t = makeText(out, fontSize, color, { layoutAlign: 'STRETCH', align: 'LEFT' });
  for (const r of ranges) {
    if (r.end > r.start) t.setRangeFills(r.start, r.end, [{ type: 'SOLID', color: theme.highlight }]);
  }
  return t;
}

// Wrap line mixing word nodes, inline icons, and {} highlights.
// Used only when the line contains at least one resolvable [icon].
function makeIconLine(lineText, theme, fontSize, color, maxWidth) {
  const iconSize = Math.round(fontSize * 1.25);
  const line = figma.createFrame();
  line.layoutMode = 'HORIZONTAL';
  line.layoutWrap = 'WRAP';
  line.resize(maxWidth, 1);
  line.primaryAxisSizingMode = 'FIXED';
  line.counterAxisSizingMode = 'AUTO';
  line.counterAxisAlignItems = 'CENTER';
  // Figma trims each text node's trailing space, so rely on itemSpacing for the
  // gap between word tokens (≈ one space). counterAxisSpacing is the line gap.
  line.itemSpacing = Math.max(4, Math.round(fontSize * 0.28));
  line.counterAxisSpacing = 8;
  line.fills = [];
  line.layoutAlign = 'STRETCH';

  const inline = { align: 'LEFT', autoResize: 'WIDTH_AND_HEIGHT' };
  let lastWasIcon = false;
  const parts = lineText.match(/(\[[^\]]+\]|\{[^}]+\}|[^[\]{}]+)/g) || [lineText];
  for (const part of parts) {
    const tagMatch = /^\[([^\]]+)\]$/.exec(part);
    if (tagMatch) {
      const icon = makeInlineIcon(tagMatch[1], iconSize);
      if (icon) {
        // Separate consecutive symbols with a comma instead of letting them touch.
        if (lastWasIcon) line.appendChild(makeText(',', fontSize, color, inline));
        line.appendChild(icon);
        lastWasIcon = true;
        continue;
      }
      line.appendChild(makeText(part, fontSize, color, inline));
      lastWasIcon = false;
      continue;
    }
    if (part.charAt(0) === '{' && part.charAt(part.length - 1) === '}') {
      line.appendChild(makeText(part.slice(1, -1), fontSize, theme.highlight, inline));
      lastWasIcon = false;
      continue;
    }
    for (const token of tokenizeText(part)) {
      if (!token.trim()) continue;
      line.appendChild(makeText(token, fontSize, color, inline));
      lastWasIcon = false;
    }
  }
  return line;
}

// Main entry: render body text (may contain \n) with inline icons + {} highlights
// + wrapping. Returns a vertical frame to append to the content frame.
function makeRichText(text, theme, fontSize, color, maxWidth) {
  const wrapper = figma.createFrame();
  wrapper.layoutMode = 'VERTICAL';
  wrapper.resize(maxWidth, 1);
  wrapper.primaryAxisSizingMode = 'AUTO';
  wrapper.counterAxisSizingMode = 'FIXED';
  wrapper.itemSpacing = 10;
  wrapper.fills = [];
  wrapper.clipsContent = false;
  wrapper.layoutAlign = 'STRETCH';

  const lines = String(text == null ? '' : text).split('\n');
  for (const line of lines) {
    if (hasInlineIcon(line)) {
      wrapper.appendChild(makeIconLine(line, theme, fontSize, color, maxWidth));
    } else {
      wrapper.appendChild(makeHighlightedLine(line, theme, fontSize, color));
    }
  }
  return wrapper;
}

function makeFrame(opts = {}) {
  const f = figma.createFrame();
  f.layoutMode = opts.direction || 'VERTICAL';
  // Resize BEFORE setting sizing modes. resize() on an auto-layout frame forces
  // the resized axes to FIXED, so any AUTO sizing must be (re)applied afterwards.
  // Skipping this is what made tables/cards collapse to height 1.
  if (opts.width !== undefined || opts.height !== undefined) {
    const w = opts.width !== undefined ? Math.max(0.01, opts.width) : f.width;
    const h = opts.height !== undefined ? Math.max(0.01, opts.height) : f.height;
    f.resize(w, h);
  }
  f.fills = opts.fills || [];
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

// Fixed-width table cell — ported from AutoHelp 3.0 (cell.layoutAlign='STRETCH'
// is the critical line that gives every cell the row's full height; without it
// the rows collapse and overlap).
function makeTblCell(width, text, theme, fontSize) {
  fontSize = fontSize || 18;
  const cell = figma.createFrame();
  cell.name = 'TBL_CELL';
  cell.layoutMode = 'VERTICAL';
  cell.resize(width, 1);
  cell.primaryAxisSizingMode = 'AUTO';
  cell.counterAxisSizingMode = 'FIXED';
  cell.layoutAlign = 'STRETCH';
  cell.primaryAxisAlignItems = 'CENTER';
  cell.counterAxisAlignItems = 'CENTER';
  cell.paddingLeft = cell.paddingRight = 12;
  cell.paddingTop = cell.paddingBottom = 10;
  cell.fills = theme.tableCellFill;
  cell.strokes = [];
  cell.clipsContent = false;
  const t = makeText(text || ' ', fontSize, theme.bodyText, { layoutAlign: 'STRETCH', align: 'CENTER' });
  cell.appendChild(t);
  return cell;
}

// Grow cell (last column) — fills remaining width via layoutGrow.
function makeTblCellGrow(text, theme, fontSize) {
  fontSize = fontSize || 18;
  const cell = figma.createFrame();
  cell.name = 'TBL_CELL';
  cell.layoutMode = 'VERTICAL';
  cell.primaryAxisSizingMode = 'AUTO';
  cell.counterAxisSizingMode = 'AUTO';
  cell.layoutGrow = 1;
  cell.layoutAlign = 'STRETCH';
  cell.primaryAxisAlignItems = 'CENTER';
  cell.counterAxisAlignItems = 'CENTER';
  cell.paddingLeft = cell.paddingRight = 12;
  cell.paddingTop = cell.paddingBottom = 10;
  cell.fills = theme.tableCellFill;
  cell.strokes = [];
  cell.clipsContent = false;
  const t = makeText(text || ' ', fontSize, theme.bodyText, { layoutAlign: 'STRETCH', align: 'CENTER' });
  cell.appendChild(t);
  return cell;
}

function makeTblContainer(contentWidth, theme) {
  const tf = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'FIXED', spacing: 0, width: contentWidth, height: 1 });
  tf.fills = [];
  tf.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
  tf.strokeWeight = 2;
  tf.strokeAlign = 'OUTSIDE';
  tf.cornerRadius = theme.cornerRadius;
  return tf;
}

function makeTblRow(contentWidth) {
  const row = figma.createFrame();
  row.layoutMode = 'HORIZONTAL';
  row.resize(contentWidth, 1);
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'MIN';
  row.itemSpacing = 0;
  row.fills = [];
  row.strokes = [];
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
    case 'feature_card':
      renderFeatureCard(page, theme, imageCache, contentFrame, frameW);
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

// ─── RENDERER: feature_text / fortune_chance / instant_bonus ────

function renderFeatureText(page, theme, contentFrame) {
  const title = makeGradientText(
    page.title, theme.titleSize, theme.titleGradient,
    { align: 'CENTER', layoutAlign: 'STRETCH' }
  );
  contentFrame.appendChild(title);

  const body = Array.isArray(page.body) ? page.body : [page.body || ''];
  contentFrame.appendChild(
    makeRichText(body.join('\n'), theme, theme.bodySize, theme.bodyText, contentFrame.width)
  );
}

// ─── RENDERER: paytable ─────────────────────────────────────────

function renderPaytable(page, theme, imageCache, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  const title = makeGradientText(
    page.title, theme.titleSize, theme.titleGradient,
    { align: 'CENTER', layoutAlign: 'STRETCH' }
  );
  contentFrame.appendChild(title);

  if (page.rules && page.rules.length) {
    contentFrame.appendChild(
      makeRichText(page.rules.join('\n'), theme, theme.bodySize - 4, theme.bodyText, contentW)
    );
  }

  if (!page.symbols || !page.symbols.length) return;

  // Premium symbols (higher max payout) first, so the big symbols sit on top
  // like the reference paytable.
  const symbols = page.symbols.slice();
  const maxVal = (s) => Math.max.apply(null, (s.payouts || []).map((p) => Number(p.value) || 0).concat([0]));
  symbols.sort((a, b) => maxVal(b) - maxVal(a));

  // Auto-fit: pick a per-row count that keeps cards a comfortable width and
  // balances the rows, so ANY number of symbols lays out neatly without overflow.
  const GAP = 16;
  const n = symbols.length;
  const MIN_CARD_W = 300;
  const MAX_PER_ROW = 6;
  let perRow = Math.max(1, Math.min(n, MAX_PER_ROW, Math.floor((contentW + GAP) / (MIN_CARD_W + GAP))));
  const rowCount = Math.ceil(n / perRow);
  perRow = Math.ceil(n / rowCount); // balance rows (avoid a lonely last card)
  const cardW = Math.floor((contentW - GAP * (perRow - 1)) / perRow);
  const iconSize = perRow >= 5 ? 60 : 72;

  const grid = makeFrame({
    direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'FIXED',
    spacing: GAP, layoutAlign: 'STRETCH', width: contentW, height: 1,
  });
  grid.fills = [];

  for (let r = 0; r < rowCount; r++) {
    const rowF = makeFrame({
      direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO',
      primaryAlign: 'CENTER', counterAlign: 'CENTER', spacing: GAP, layoutAlign: 'STRETCH',
    });
    rowF.fills = [];
    const slice = symbols.slice(r * perRow, (r + 1) * perRow);
    for (const sym of slice) rowF.appendChild(makePayCard(sym, cardW, iconSize, theme, imageCache));
    grid.appendChild(rowF);
  }
  contentFrame.appendChild(grid);
}

// Horizontal payout card: icon on the left, "range  value" lines on the right.
function makePayCard(sym, cardW, iconSize, theme, imageCache) {
  const card = makeFrame({
    direction: 'HORIZONTAL', primarySize: 'FIXED', counterSize: 'AUTO',
    primaryAlign: 'MIN', counterAlign: 'CENTER', spacing: 12, padding: 12, cornerRadius: 10,
    width: cardW, height: 1,
  });
  card.fills = [{ type: 'SOLID', color: { r: 0.16, g: 0.13, b: 0.26 } }];
  card.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
  card.strokeWeight = 2;
  card.strokeAlign = 'INSIDE';

  card.appendChild(makeIconFrame(sym.asset, iconSize, imageCache, theme));

  // Only render payouts that have BOTH a range and a value — skips the broken
  // "8-9 <blank>" rows that appear when the AI couldn't read a value.
  const payouts = (sym.payouts || []).filter(
    (p) => p && (p.range || p.count) != null && String(p.range || p.count).trim() &&
           p.value != null && String(p.value).trim()
  );
  const payLines = payouts.map((p) => (p.range || p.count) + '   ' + p.value).join('\n');
  const payText = makeText(payLines || ' ', 17, theme.bodyText, { align: 'LEFT', layoutGrow: 1, layoutAlign: 'STRETCH' });
  card.appendChild(payText);
  return card;
}

// ─── RENDERER: multi_section ────────────────────────────────────

function renderMultiSection(page, theme, imageCache, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  const title = makeGradientText(
    page.title, theme.titleSize, theme.titleGradient,
    { align: 'CENTER', layoutAlign: 'STRETCH' }
  );
  contentFrame.appendChild(title);

  if (page.body && page.body.length) {
    const bodyText = Array.isArray(page.body) ? page.body.join('\n') : page.body;
    contentFrame.appendChild(makeRichText(bodyText, theme, theme.bodySize, theme.bodyText, contentW));
  }

  if (page.sections && page.sections.length) {
    for (const sec of page.sections) {
      const subTitle = makeText(
        sec.subtitle, theme.subtitleSize, theme.subtitleColor,
        { align: 'CENTER', layoutAlign: 'STRETCH', bold: true }
      );
      contentFrame.appendChild(subTitle);

      if (sec.body && sec.body.length) {
        const subBody = Array.isArray(sec.body) ? sec.body.join('\n') : sec.body;
        contentFrame.appendChild(makeRichText(subBody, theme, theme.bodySize, theme.bodyText, contentW));
      }
    }
  }

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

// ─── RENDERER: jackpot ──────────────────────────────────────────

function renderJackpot(page, theme, contentFrame, frameW) {
  const PADDING = theme.padding;
  const contentW = frameW - PADDING * 2;

  const title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.rules && page.rules.length) {
    contentFrame.appendChild(
      makeRichText(page.rules.join('\n'), theme, theme.bodySize, theme.bodyText, contentW)
    );
  }

  var tf = makeTblContainer(contentW, theme);
  var BET_W = 160;
  var DENOM_COLS = 5;
  var denomColW = Math.floor((contentW - BET_W) / DENOM_COLS);

  var headerRow = makeTblRow(contentW);
  headerRow.appendChild(makeTblCell(BET_W, '', theme));
  headerRow.appendChild(makeVSep(theme));
  headerRow.appendChild(makeTblCellGrow('DENOMINATION', theme, 20));
  tf.appendChild(headerRow);

  // Table rows come from the DENOMINATION table (strip any [ ] around labels).
  // Fall back to jackpotTiers, then to the common MINI/MINOR default.
  var dt = page.denominationTable || {};
  var tiers2 = (dt.rows && dt.rows.length)
    ? dt.rows.map(function (r) { return String(r).replace(/[\[\]]/g, '').trim(); })
    : (page.jackpotTiers || ['MINI', 'MINOR']);
  var tierColors2 = { GRAND: {r:0.95,g:0.15,b:0.15}, MAJOR: {r:0.55,g:0.10,b:0.80}, MINOR: {r:0.20,g:0.60,b:0.95}, MINI: {r:0.20,g:0.75,b:0.30} };
  for (var j = 0; j < tiers2.length; j++) {
    var tierName = tiers2[j];
    tf.appendChild(makeHSep(theme));
    var row = makeTblRow(contentW);
    var cell = makeTblCell(BET_W, tierName, theme);
    var cellColor = tierColors2[tierName.toUpperCase()] || theme.subtitleColor;
    cell.children[0].fills = [{ type: 'SOLID', color: cellColor }];
    row.appendChild(cell);
    row.appendChild(makeVSep(theme));
    for (var k = 0; k < DENOM_COLS; k++) {
      if (k > 0) row.appendChild(makeVSep(theme));
      if (k < DENOM_COLS - 1) {
        row.appendChild(makeTblCell(denomColW, '', theme));
      } else {
        row.appendChild(makeTblCellGrow('', theme));
      }
    }
    tf.appendChild(row);
  }

  tf.layoutAlign = 'STRETCH';
  contentFrame.appendChild(tf);
}

// ─── RENDERER: symbols_per_play ─────────────────────────────────

function renderSymbolsPerPlay(page, theme, imageCache, contentFrame, frameW) {
  var PADDING = theme.padding;
  var contentW = frameW - PADDING * 2;
  var BET_W = 130;
  var ICON_SIZE = 56;

  var title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.note) {
    contentFrame.appendChild(makeRichText(page.note, theme, theme.bodySize - 4, theme.bodyText, contentW));
  }

  var tf = makeTblContainer(contentW, theme);

  var header = makeTblRow(contentW);
  header.appendChild(makeTblCell(BET_W, 'BET', theme, 20));
  header.appendChild(makeVSep(theme));
  header.appendChild(makeTblCellGrow('SYMBOLS', theme, 20));
  tf.appendChild(header);

  var bets = page.bets || [];
  for (var bi = 0; bi < bets.length; bi++) {
    var bet = bets[bi];
    tf.appendChild(makeHSep(theme));
    var row = makeTblRow(contentW);
    row.appendChild(makeTblCell(BET_W, String(bet.amount || ''), theme, 22));
    row.appendChild(makeVSep(theme));

    var symCell = makeFrame({
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

    var iconRow = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 8, layoutAlign: 'STRETCH' });
    iconRow.layoutWrap = 'WRAP';
    iconRow.counterAxisSpacing = 8;
    iconRow.fills = [];

    var activeSyms = bet.activeSymbols || [];
    for (var ai = 0; ai < activeSyms.length; ai++) {
      iconRow.appendChild(makeIconFrame(activeSyms[ai], ICON_SIZE, imageCache, theme));
    }

    var removedSyms = bet.removedSymbols || [];
    for (var ri = 0; ri < removedSyms.length; ri++) {
      var xf = makeFrame({ primarySize: 'FIXED', counterSize: 'FIXED', primaryAlign: 'CENTER', counterAlign: 'CENTER', name: 'TBL_CELL' });
      xf.resize(ICON_SIZE, ICON_SIZE);
      xf.fills = [{ type: 'SOLID', color: { r: 0.65, g: 0.12, b: 0.08 } }];
      xf.cornerRadius = 4;
      var xt = makeText('✕', Math.floor(ICON_SIZE * 0.55), { r: 1, g: 1, b: 1 }, { align: 'CENTER' });
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
  var PADDING = theme.padding;
  var contentW = frameW - PADDING * 2;

  var title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.note) {
    contentFrame.appendChild(makeRichText(page.note, theme, theme.bodySize - 4, theme.bodyText, contentW));
  }

  var rows = page.rows || [];
  var MAX_PER_COL = 14;
  var BET_W = 120;

  function buildSingleTable(rowSlice, width) {
    var tf = makeTblContainer(width, theme);
    for (var i = 0; i < rowSlice.length; i++) {
      if (i > 0) tf.appendChild(makeHSep(theme));
      var r = rowSlice[i];
      var dataRow = makeTblRow(width);
      dataRow.appendChild(makeTblCell(BET_W, 'BET ' + (r.bet || ''), theme));
      dataRow.appendChild(makeVSep(theme));
      dataRow.appendChild(makeTblCellGrow((r.min || '') + ' ~ ' + (r.max || ''), theme));
      tf.appendChild(dataRow);
    }
    return tf;
  }

  if (rows.length > MAX_PER_COL) {
    var mid = Math.ceil(rows.length / 2);
    var colW = Math.floor((contentW - 24) / 2);
    var container = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 24, layoutAlign: 'STRETCH' });
    container.fills = [];
    container.appendChild(buildSingleTable(rows.slice(0, mid), colW));
    container.appendChild(buildSingleTable(rows.slice(mid), colW));
    contentFrame.appendChild(container);
  } else {
    var tf2 = buildSingleTable(rows, contentW);
    tf2.layoutAlign = 'STRETCH';
    contentFrame.appendChild(tf2);
  }
}

// ─── RENDERER: setting_info ─────────────────────────────────────

function renderSettingInfo(page, theme, contentFrame, frameW) {
  var PADDING = theme.padding;
  var contentW = frameW - PADDING * 2;
  var BET_W = 200;

  var title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  var tf = makeTblContainer(contentW, theme);
  var halfW = Math.floor((contentW - BET_W) / 2);

  var header = makeTblRow(contentW);
  header.appendChild(makeTblCell(BET_W, '', theme));
  header.appendChild(makeVSep(theme));
  header.appendChild(makeTblCell(halfW, 'MINIMUM', theme, 20));
  header.appendChild(makeVSep(theme));
  header.appendChild(makeTblCellGrow('MAXIMUM', theme, 20));
  tf.appendChild(header);

  // Always render the standard WAYS / TOTAL BET structure even when the AI
  // returns no rows (min/max are filled in later / are dynamic, like in 3.0).
  var settingRows = (page.rows && page.rows.length) ? page.rows : [
    { label: 'WAYS', min: '', max: '' },
    { label: 'TOTAL BET', min: '', max: '' },
  ];
  for (var i = 0; i < settingRows.length; i++) {
    var r = settingRows[i];
    tf.appendChild(makeHSep(theme));
    var row = makeTblRow(contentW);
    row.appendChild(makeTblCell(BET_W, r.label || '', theme));
    row.appendChild(makeVSep(theme));
    row.appendChild(makeTblCell(halfW, r.min || '', theme));
    row.appendChild(makeVSep(theme));
    row.appendChild(makeTblCellGrow(r.max || '', theme));
    tf.appendChild(row);
  }

  tf.layoutAlign = 'STRETCH';
  contentFrame.appendChild(tf);

  var denomSections = page.denominationSections || [];
  for (var ds = 0; ds < denomSections.length; ds++) {
    var sec = denomSections[ds];
    if (sec.label) {
      contentFrame.appendChild(
        makeText(sec.label + ':', theme.bodySize, theme.bodyText, { align: 'LEFT', layoutAlign: 'STRETCH' })
      );
    }
    // Medium-height reserved box (~1 row of buttons). The frontend drops the
    // denomination / bet-button images in here later; text sits near the top.
    var BOX_H = 140;
    var secFrame = makeFrame({
      direction: 'VERTICAL',
      primarySize: 'FIXED',
      counterSize: 'FIXED',
      primaryAlign: 'MIN',
      counterAlign: 'CENTER',
      padding: 16,
      layoutAlign: 'STRETCH',
      height: BOX_H,
    });
    secFrame.fills = theme.tableCellFill;
    secFrame.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
    secFrame.strokeWeight = 1;
    secFrame.strokeAlign = 'INSIDE';
    secFrame.cornerRadius = 6;
    if (sec.body) {
      var bodyText = Array.isArray(sec.body) ? sec.body.join('\n') : sec.body;
      secFrame.appendChild(makeText(bodyText, theme.bodySize - 4, theme.bodyText, { align: 'CENTER', layoutAlign: 'STRETCH' }));
    }
    contentFrame.appendChild(secFrame);
  }
}

// ─── RENDERER: feature_card (SCATTER/WILD — icon+payouts left, rules right) ──

function renderFeatureCard(page, theme, imageCache, contentFrame, frameW) {
  var PADDING = theme.padding;
  var contentW = frameW - PADDING * 2;
  var ICON_SIZE = 190;
  var LEFT_W = 340;

  var cards = page.cards || [];

  // Show the page title only if it isn't just repeating the single card's label.
  var soleLabel = (cards.length === 1 && cards[0].label) ? String(cards[0].label).toUpperCase() : '';
  if (page.title && String(page.title).toUpperCase() !== soleLabel) {
    contentFrame.appendChild(
      makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' })
    );
  }

  for (var ci = 0; ci < cards.length; ci++) {
    var c = cards[ci];

    var card = makeFrame({
      direction: 'HORIZONTAL', primarySize: 'FIXED', counterSize: 'AUTO',
      primaryAlign: 'MIN', counterAlign: 'CENTER', spacing: 28, padding: 28,
      cornerRadius: 12, layoutAlign: 'STRETCH', width: contentW,
    });
    card.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.13, b: 0.25 } }];
    card.strokes = [{ type: 'SOLID', color: theme.tableBorder }];
    card.strokeWeight = 2;
    card.strokeAlign = 'INSIDE';

    // LEFT: label + big icon + payouts
    var left = makeFrame({
      direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'FIXED',
      primaryAlign: 'CENTER', counterAlign: 'CENTER', spacing: 10, width: LEFT_W,
    });
    left.fills = [];
    if (c.label) {
      left.appendChild(makeText(c.label, theme.subtitleSize, theme.subtitleColor, { align: 'CENTER', bold: true }));
    }
    left.appendChild(makeIconFrame(c.icon, ICON_SIZE, imageCache, theme));
    var payouts = (c.payouts || []).filter(function (p) {
      return p && (p.range || p.count) != null && String(p.range || p.count).trim() && p.value != null && String(p.value).trim();
    });
    if (payouts.length) {
      var payCol = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'AUTO', primaryAlign: 'CENTER', counterAlign: 'CENTER', spacing: 4 });
      payCol.fills = [];
      for (var pi = 0; pi < payouts.length; pi++) {
        var p = payouts[pi];
        var prow = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', counterAlign: 'CENTER', spacing: 8 });
        prow.fills = [];
        prow.appendChild(makeText(String(p.range || p.count) + '  —', 22, theme.bodyText, { align: 'RIGHT', autoResize: 'WIDTH_AND_HEIGHT' }));
        prow.appendChild(makeText(String(p.value), 22, theme.highlight, { align: 'LEFT', autoResize: 'WIDTH_AND_HEIGHT' }));
        payCol.appendChild(prow);
      }
      left.appendChild(payCol);
    }
    card.appendChild(left);

    // RIGHT: rules text (fills remaining width)
    var right = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 0 });
    right.layoutGrow = 1;
    right.layoutAlign = 'STRETCH';
    right.fills = [];
    var body = Array.isArray(c.body) ? c.body.join('\n') : (c.body || '');
    if (body) {
      right.appendChild(makeRichText(body, theme, theme.bodySize - 2, theme.bodyText, contentW - LEFT_W - 84));
    }
    card.appendChild(right);

    contentFrame.appendChild(card);
  }
}

// ─── RENDERER: special_feature ──────────────────────────────────

function renderSpecialFeature(page, theme, contentFrame, frameW) {
  var title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.note) {
    contentFrame.appendChild(makeRichText(page.note, theme, theme.bodySize, theme.bodyText, contentFrame.width));
  }

  var sections = page.sections || [];
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var subTitle = makeText(sec.subtitle, theme.subtitleSize, theme.subtitleColor, { bold: true, layoutAlign: 'STRETCH' });
    contentFrame.appendChild(subTitle);
    if (sec.body && sec.body.length) {
      var bodyText = Array.isArray(sec.body) ? sec.body.join('\n') : sec.body;
      contentFrame.appendChild(makeRichText(bodyText, theme, theme.bodySize, theme.bodyText, contentFrame.width));
    }
  }
}

// ─── RENDERER: combo_feature ────────────────────────────────────

function renderComboFeature(page, theme, contentFrame, frameW) {
  var title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  if (page.triggerRules && page.triggerRules.length) {
    contentFrame.appendChild(makeRichText(page.triggerRules.join('\n'), theme, theme.bodySize, theme.bodyText, contentFrame.width));
  }

  var effects = page.effects || [];
  for (var i = 0; i < effects.length; i++) {
    var effect = effects[i];
    var subTitle = makeText(effect.name, theme.subtitleSize, theme.subtitleColor, { align: 'CENTER', bold: true, layoutAlign: 'STRETCH' });
    contentFrame.appendChild(subTitle);
    if (effect.rules && effect.rules.length) {
      contentFrame.appendChild(makeRichText(effect.rules.join('\n'), theme, theme.bodySize, theme.bodyText, contentFrame.width));
    }
  }
}

// ─── RENDERER: game_settings ────────────────────────────────────

function renderGameSettings(page, theme, contentFrame, frameW) {
  var PADDING = theme.padding;
  var contentW = frameW - PADDING * 2;

  var title = makeGradientText(page.title, theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  // ── Reel grid: reels (columns) × height (rows), driven by boardInfo so it
  //    adapts to any board the description states (6×5, 5×4, …). ──
  var info = page.boardInfo || {};
  var cols = Math.max(1, parseInt(info.reels, 10) || 6);
  var rows = Math.max(1, parseInt(info.height, 10) || 5);
  var maxBoardW = Math.floor(contentW * 0.62);
  var maxBoardH = Math.floor((contentW * 9) / 16 * 0.5);
  var cellSize = Math.max(24, Math.min(Math.floor(maxBoardW / cols), Math.floor(maxBoardH / rows)));
  var gridColor = { r: 0.85, g: 0.25, b: 0.30 };

  var boardWrap = makeFrame({ direction: 'HORIZONTAL', primarySize: 'FIXED', counterSize: 'AUTO', primaryAlign: 'CENTER', width: contentW, layoutAlign: 'STRETCH', name: 'board_grid' });
  boardWrap.fills = [];
  var grid = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 0 });
  grid.fills = [];
  for (var r = 0; r < rows; r++) {
    var rowFrame = makeFrame({ direction: 'HORIZONTAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 0 });
    rowFrame.fills = [];
    for (var c = 0; c < cols; c++) {
      var cell = figma.createFrame();
      cell.resize(cellSize, cellSize);
      cell.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.06 }];
      cell.strokes = [{ type: 'SOLID', color: gridColor }];
      cell.strokeWeight = 2;
      cell.strokeAlign = 'INSIDE';
      rowFrame.appendChild(cell);
    }
    grid.appendChild(rowFrame);
  }
  boardWrap.appendChild(grid);
  contentFrame.appendChild(boardWrap);

  // ── Description lines: prefer the AI's original rule text (keeps {} number
  //    highlights and the [scatter] icon); fall back to rebuilt sentences. ──
  var bodyLines = (page.rules && page.rules.length) ? page.rules.slice() : [];
  if (!bodyLines.length) {
    if (info.reels) bodyLines.push('．THE GAME IS PLAYED ON A BOARD OF {' + info.reels + '} REELS, EACH WITH A HEIGHT OF {' + (info.height || '?') + '}.');
    if (info.clusterMin) bodyLines.push('．WINS ARE EVALUATED USING THE CLUSTER PAY MODEL: GROUPS OF {' + info.clusterMin + '} OR MORE IDENTICAL SYMBOLS, AND {' + (info.scatterMin || '4') + '} OR MORE [C1].');
  }
  if (bodyLines.length) {
    contentFrame.appendChild(makeRichText(bodyLines.join('\n'), theme, theme.bodySize, theme.bodyText, contentW));
  }

  // ── Copyright / IP announcement pinned to the bottom of the page. ──
  if (page.copyright) {
    var spacer = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'AUTO', layoutAlign: 'STRETCH', layoutGrow: 1 });
    spacer.fills = [];
    contentFrame.appendChild(spacer);

    // Put the "© …" notice on its own line (like the reference), and keep the
    // block narrower than full width so it wraps in a tidy centred column.
    var copyStr = String(page.copyright).replace(/\s*(©)/, '\n$1');
    var copyWrap = makeFrame({ direction: 'HORIZONTAL', primarySize: 'FIXED', counterSize: 'AUTO', primaryAlign: 'CENTER', width: contentW, layoutAlign: 'STRETCH' });
    copyWrap.fills = [];
    var copyNode = makeText(copyStr, 14, { r: 0.7, g: 0.7, b: 0.7 }, { align: 'CENTER' });
    copyNode.textAutoResize = 'HEIGHT';
    copyNode.resize(Math.floor(contentW * 0.82), copyNode.height);
    copyWrap.appendChild(copyNode);
    contentFrame.appendChild(copyWrap);

    // Reserve empty space BELOW the copyright so later elements (added by the
    // frontend) don't overlap it. Adjust BOTTOM_RESERVE to taste.
    var BOTTOM_RESERVE = 100;
    var bottomGap = makeFrame({ direction: 'VERTICAL', primarySize: 'FIXED', counterSize: 'FIXED', layoutAlign: 'STRETCH', width: contentW, height: BOTTOM_RESERVE });
    bottomGap.fills = [];
    contentFrame.appendChild(bottomGap);
  }
}

// ─── RENDERER: spin_button ──────────────────────────────────────

function renderSpinButton(page, theme, imageCache, contentFrame, frameW) {
  var PADDING = theme.padding;
  var contentW = frameW - PADDING * 2;
  var ICON_SIZE = 140;

  // Card: [ icon placeholder ]  [ title + body ]. Width is fixed to the content
  // width and the height hugs the content, so the card never collapses — even
  // when no image is uploaded the icon shows a reserved placeholder box.
  var card = makeFrame({
    direction: 'HORIZONTAL',
    primarySize: 'FIXED',
    counterSize: 'AUTO',
    primaryAlign: 'MIN',
    counterAlign: 'CENTER',
    spacing: 28,
    padding: 28,
    cornerRadius: 12,
    width: contentW,
    layoutAlign: 'STRETCH',
  });
  card.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.13, b: 0.25 } }];

  var icon = makeIconFrame(page.icon, ICON_SIZE, imageCache, theme);
  card.appendChild(icon);

  var textCol = makeFrame({ direction: 'VERTICAL', primarySize: 'AUTO', counterSize: 'AUTO', spacing: 12 });
  textCol.layoutGrow = 1;
  textCol.layoutAlign = 'STRETCH';
  textCol.fills = [];

  var titleNode = makeText(page.title, theme.subtitleSize, theme.subtitleColor, { bold: true, layoutAlign: 'STRETCH' });
  textCol.appendChild(titleNode);

  var bodyText = typeof page.body === 'string' ? page.body : (page.body || []).join('\n');
  if (bodyText) {
    textCol.appendChild(makeRichText(bodyText, theme, theme.bodySize, theme.bodyText, contentW - ICON_SIZE - 90));
  }

  card.appendChild(textCol);
  contentFrame.appendChild(card);
}

// ─── RENDERER: custom (fallback) ────────────────────────────────

function renderCustom(page, theme, contentFrame) {
  var title = makeGradientText(page.title || 'Custom Page', theme.titleSize, theme.titleGradient, { align: 'CENTER', layoutAlign: 'STRETCH' });
  contentFrame.appendChild(title);

  var content = typeof page.content === 'string' ? page.content : JSON.stringify(page.content || '', null, 2);
  contentFrame.appendChild(makeRichText(content, theme, theme.bodySize, theme.bodyText, contentFrame.width));
}
