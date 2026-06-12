import { findByName } from './assetStore.js';

// Scans a Layout Plan for every asset name referenced by its pages.
export function collectAssetNames(plan) {
  const names = new Set();
  const add = (n) => { if (n && typeof n === 'string' && n.trim()) names.add(n.trim()); };

  // Scan a single string for inline [tag] references.
  const scanString = (str) => {
    const re = /\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(str)) !== null) add(m[1]);
  };
  // Walk every string value in the page (only strings — never JSON brackets).
  const walk = (node) => {
    if (typeof node === 'string') { scanString(node); return; }
    if (Array.isArray(node)) { for (const x of node) walk(x); return; }
    if (node && typeof node === 'object') { for (const k of Object.keys(node)) walk(node[k]); }
  };

  for (const page of (plan.pages || [])) {
    // Structured (non-bracketed) references
    add(page.icon);
    for (const s of (page.symbols || [])) add(s.asset);
    for (const sec of (page.sections || [])) add(sec.icon);
    for (const bet of (page.bets || [])) {
      for (const a of (bet.activeSymbols || [])) add(a);
      for (const a of (bet.removedSymbols || [])) add(a);
    }
    // Inline [tag] references in any text field (rules, body, sections, notes…).
    walk(page);
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
