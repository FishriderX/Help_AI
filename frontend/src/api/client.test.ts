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
