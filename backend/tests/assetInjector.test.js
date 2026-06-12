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

test('collectAssetNames extracts inline [tag] references from body text', () => {
  const plan = {
    pages: [
      { type: 'feature_text', title: 'FREE GAMES', body: ['TRIGGERED WHEN {4} OR MORE [C1] APPEAR.', 'SEE [C2] AND [C3].'] },
    ],
  };
  expect(collectAssetNames(plan).sort()).toEqual(['C1', 'C2', 'C3']);
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
