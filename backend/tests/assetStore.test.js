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
