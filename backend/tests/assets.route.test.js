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
