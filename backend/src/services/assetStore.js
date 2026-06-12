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
