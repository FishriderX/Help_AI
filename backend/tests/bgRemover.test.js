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
